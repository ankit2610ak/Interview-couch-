import os
import re
import json
from typing import Any, Dict, List, Tuple
from dotenv import load_dotenv
from groq import Groq

# Load environment variables from .env file
load_dotenv()


def get_model_name() -> str:
    """Return the configured Groq model name, defaulting to openai/gpt-oss-120b."""
    return os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")


INTERVIEWER_SYSTEM_PROMPT = """You are an expert technical interviewer conducting a technical interview on the topic of "{topic}" at the "{difficulty}" difficulty level.

Guidelines and Instructions:
- Ask one clear, focused question at a time appropriate to the topic and difficulty.
- Difficulty Guidelines:
  * Easy difficulty: Ask basic recall and fundamental definition questions.
  * Medium difficulty: Ask applied understanding, practical scenarios, and problem-solving questions.
  * Hard difficulty: Ask deep expertise, architectural trade-offs, edge cases, and system-thinking questions.
- After each answer from the candidate, evaluate and decide one of three actions:
  a. If the answer is strong: Acknowledge briefly in one sentence, then ask a question on a different aspect of the topic.
  b. If the answer is partially correct: Probe deeper with one specific follow-up question. Do not reveal the correct answer.
  c. If the answer is incorrect: Note the gap in one sentence, then move to a different question.
- Overall Performance Monitoring:
  * Monitor the candidate's overall performance throughout the interview.
  * If the candidate is clearly struggling across multiple topics, naturally conclude the interview early with a kind, supportive note.
  * If the candidate is performing very well, feel free to wrap up after covering the key areas rather than continuing unnecessarily.
- When concluding the interview early or naturally, you MUST end your message with the exact phrase: [INTERVIEW COMPLETE]
- Strict Rules:
  * Never teach.
  * Never give hints.
  * Never reveal answers.
  * Keep your tone professional, neutral, and encouraging.
  * Ask only ONE question per message."""

REPORT_SYSTEM_PROMPT = """You are an expert interview evaluator.
Your role is to evaluate the provided full conversation transcript of a technical interview and produce a comprehensive evaluation report.

Scoring Guide:
- 85 to 100: Excellent performance.
- 70 to 84: Good performance.
- 55 to 69: Adequate performance.
- Below 55: Weak performance.

You must return ONLY a valid JSON object with no extra text, explanations, or markdown formatting (do not wrap in ```json blocks).

The JSON must have exactly these fields:
- score: integer (0 to 100)
- strengths: string (2 to 4 specific sentences referencing actual answers)
- weaknesses: string (2 to 4 specific sentences referencing gaps)
- revision_areas: string (comma-separated list of 3 to 5 specific topics)
- verdict: string (2 to 3 sentences of overall direct assessment)
- recommendation: string (must be exactly the word Pass or the word Fail)"""
TOPIC_VALIDATION_PROMPT = """You are an expert technical interview topic validator.
Analyze the user's proposed interview topic: "{topic}".

Guidelines:
- ACCEPT: Any technical, engineering, software, computer science, data, IT, or professional job interview subject.
- ACCEPT: Slight typos, misspellings, or phonetic spellings of valid subjects (e.g., "pyton" -> Python, "reack" -> React, "javascrpt" -> JavaScript, "kubernets" -> Kubernetes, "sytem design" -> System Design, "algo", "dsa", "sqll"). If it reasonably matches a recognizable topic despite a typo, mark it VALID.
- REJECT: Pure gibberish, random keyboard mash (e.g. "asdfgh", "qwerty", "zxcvbnm"), arbitrary placeholder acronyms or words with no interview context (e.g. "lala", "xyz", "abc", "foo", "bar", "blablabla").

Respond with ONLY one word: VALID or INVALID."""


def is_syntactically_invalid_topic(topic: str) -> bool:
    """Fast local heuristic check for obvious gibberish or non-topic strings."""
    cleaned = topic.strip().lower()
    if len(cleaned) < 2:
        return True
    if not re.search(r"[a-zA-Z]", cleaned):
        return True
    # Pure repeated chars like aaaaa, zzzzz
    if re.match(r"^(.)\1+$", cleaned):
        return True
    # Common test / dummy strings
    if cleaned in {"lala", "xyz", "abc", "asdf", "qwerty", "test", "foo", "bar", "baz", "none", "na", "null"}:
        return True
    return False


def validate_interview_topic(topic: str) -> bool:
    """Validate whether an interview topic is valid and recognizable.

    First applies instant heuristic checks, then validates with Groq LLM if ambiguous.
    """
    if is_syntactically_invalid_topic(topic):
        return False

    try:
        client = get_groq_client()
        model = get_model_name()
        response = client.chat.completions.create(
            model=model,
            messages=[{
                "role": "user",
                "content": TOPIC_VALIDATION_PROMPT.format(topic=topic),
            }],
            temperature=0.0,
            max_tokens=250,
        )
        content = (response.choices[0].message.content or "").strip().upper()
        if "INVALID" in content:
            return False
        return True
    except Exception:
        # If validator LLM call fails, fail open so legitimate users aren't blocked
        return True


def get_groq_client() -> Groq:
    """Initialize and return the Groq client using GROQ_API_KEY."""
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise ValueError(
            "GROQ_API_KEY environment variable is not set. Please provide it in your .env file or environment."
        )
    return Groq(api_key=api_key)


def get_next_interviewer_message(
    topic: str,
    difficulty: str,
    conversation_history: List[Dict[str, Any]],
) -> Tuple[str, bool]:
    """Generate the next interviewer message based on conversation history.

    Parameters:
    - topic: The technical topic for the interview.
    - difficulty: The difficulty level (Easy, Medium, Hard).
    - conversation_history: List of conversation messages (dicts with 'role' and 'content').

    Returns:
    - Tuple of (response_text, is_complete)
      where response_text has [INTERVIEW COMPLETE] stripped if completed,
      and is_complete is True if the phrase was present.
    """
    client = get_groq_client()

    formatted_system_prompt = INTERVIEWER_SYSTEM_PROMPT.format(
        topic=topic,
        difficulty=difficulty,
    )

    messages: List[Dict[str, str]] = [
        {"role": "system", "content": formatted_system_prompt}
    ]

    for msg in conversation_history:
        messages.append({
            "role": str(msg.get("role", "user")),
            "content": str(msg.get("content", "")),
        })

    # If starting fresh without history, prompt the interviewer to initiate the interview
    if len(messages) == 1:
        messages.append({
            "role": "user",
            "content": f"Hello, I am ready to begin the {difficulty} interview on {topic}.",
        })

    response = client.chat.completions.create(
        model=get_model_name(),
        messages=messages,
        temperature=0.7,
        max_tokens=500,
    )

    response_text = response.choices[0].message.content or ""

    complete_marker = "[INTERVIEW COMPLETE]"
    is_complete = complete_marker in response_text

    if is_complete:
        response_text = response_text.replace(complete_marker, "").strip()

    return response_text, is_complete


def generate_interview_report(
    topic: str,
    difficulty: str,
    conversation_history: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """Generate a structured evaluation report from the interview conversation history.

    Parameters:
    - topic: The technical topic of the interview.
    - difficulty: The difficulty level.
    - conversation_history: List of conversation messages.

    Returns:
    - Parsed dictionary containing score, strengths, weaknesses, revision_areas, verdict, and recommendation.
    """
    client = get_groq_client()

    # Build transcript string from conversation history
    transcript_lines: List[str] = []
    for msg in conversation_history:
        role = str(msg.get("role", "unknown")).lower()
        if role in ("assistant", "interviewer", "ai"):
            speaker = "Interviewer"
        elif role in ("user", "candidate", "human"):
            speaker = "Candidate"
        elif role == "system":
            continue
        else:
            speaker = role.capitalize()

        content = str(msg.get("content", "")).strip()
        transcript_lines.append(f"{speaker}: {content}")

    transcript = "\n\n".join(transcript_lines) if transcript_lines else "No conversation recorded."

    user_prompt = (
        f"Interview Topic: {topic}\n"
        f"Difficulty: {difficulty}\n\n"
        f"Full Conversation Transcript:\n"
        f"{transcript}\n\n"
        f"Generate the evaluation report JSON according to the instructions."
    )

    messages: List[Dict[str, str]] = [
        {"role": "system", "content": REPORT_SYSTEM_PROMPT},
        {"role": "user", "content": user_prompt},
    ]

    response = client.chat.completions.create(
        model=get_model_name(),
        messages=messages,
        temperature=0.3,
        max_tokens=1000,
        response_format={"type": "json_object"},
    )

    raw_content = response.choices[0].message.content or ""

    # Parse JSON with regex extraction fallback
    try:
        parsed_report = json.loads(raw_content)
    except (json.JSONDecodeError, TypeError):
        # Fallback: extract JSON substring using regex
        match = re.search(r"\{.*\}", raw_content, re.DOTALL)
        if match:
            try:
                parsed_report = json.loads(match.group(0))
            except json.JSONDecodeError as err:
                raise ValueError(
                    f"Failed to parse extracted JSON object from model response:\n{raw_content}"
                ) from err
        else:
            raise ValueError(
                f"No valid JSON object could be extracted from model response:\n{raw_content}"
            )

    return parsed_report
