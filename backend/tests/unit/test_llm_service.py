import json
import os
from unittest.mock import MagicMock, patch
import pytest

from services import llm_service


class TestLLMPrompts:
    def test_interviewer_prompt_template_variables(self):
        """Verify INTERVIEWER_SYSTEM_PROMPT formats topic and difficulty correctly."""
        prompt = llm_service.INTERVIEWER_SYSTEM_PROMPT.format(
            topic="Distributed Systems",
            difficulty="Hard",
        )
        assert "Distributed Systems" in prompt
        assert "Hard" in prompt
        assert "Easy difficulty" in prompt
        assert "Medium difficulty" in prompt
        assert "Hard difficulty" in prompt
        assert "[INTERVIEW COMPLETE]" in prompt
        assert "Never teach" in prompt
        assert "Ask only ONE question" in prompt

    def test_report_prompt_structure_and_guide(self):
        """Verify REPORT_SYSTEM_PROMPT contains all required schema keys and scoring bands."""
        prompt = llm_service.REPORT_SYSTEM_PROMPT
        required_keys = [
            "score",
            "strengths",
            "weaknesses",
            "revision_areas",
            "verdict",
            "recommendation",
        ]
        for key in required_keys:
            assert key in prompt

        # Scoring bands
        assert "85 to 100" in prompt
        assert "70 to 84" in prompt
        assert "55 to 69" in prompt
        assert "Below 55" in prompt
        assert "Pass" in prompt
        assert "Fail" in prompt


class TestGetGroqClient:
    def test_get_groq_client_raises_when_no_api_key(self):
        """Should raise ValueError if GROQ_API_KEY is not set."""
        with patch.dict(os.environ, {"GROQ_API_KEY": ""}, clear=True):
            with pytest.raises(ValueError, match="GROQ_API_KEY environment variable is not set"):
                llm_service.get_groq_client()

    def test_get_groq_client_success(self):
        """Should return a Groq instance when GROQ_API_KEY is present."""
        with patch.dict(os.environ, {"GROQ_API_KEY": "gsk_test_fake_key_12345"}):
            client = llm_service.get_groq_client()
            assert client is not None
            assert client.api_key == "gsk_test_fake_key_12345"


class TestGetNextInterviewerMessage:
    @patch("services.llm_service.get_groq_client")
    def test_start_message_with_empty_history(self, mock_get_client):
        """When history is empty, an initial user starter is passed, returning opening question."""
        mock_client = MagicMock()
        mock_get_client.return_value = mock_client

        mock_resp = MagicMock()
        mock_resp.choices = [
            MagicMock(message=MagicMock(content="What is the difference between synchronous and asynchronous code?"))
        ]
        mock_client.chat.completions.create.return_value = mock_resp

        msg, is_complete = llm_service.get_next_interviewer_message("JavaScript", "Medium", [])

        assert msg == "What is the difference between synchronous and asynchronous code?"
        assert is_complete is False

        # Verify call arguments
        call_kwargs = mock_client.chat.completions.create.call_args[1]
        assert call_kwargs["temperature"] == 0.7
        assert call_kwargs["max_tokens"] == 500
        messages = call_kwargs["messages"]
        assert len(messages) == 2
        assert messages[0]["role"] == "system"
        assert "JavaScript" in messages[0]["content"]
        assert "Medium" in messages[0]["content"]
        assert messages[1]["role"] == "user"

    @patch("services.llm_service.get_groq_client")
    def test_ongoing_message_with_history(self, mock_get_client):
        """When history exists, full conversation is provided to chat completions."""
        mock_client = MagicMock()
        mock_get_client.return_value = mock_client

        mock_resp = MagicMock()
        mock_resp.choices = [
            MagicMock(message=MagicMock(content="Good point. How does the event loop handle promises?"))
        ]
        mock_client.chat.completions.create.return_value = mock_resp

        history = [
            {"role": "assistant", "content": "What is an event loop?"},
            {"role": "user", "content": "It allows JS to perform non-blocking I/O operations."},
        ]

        msg, is_complete = llm_service.get_next_interviewer_message("Node.js", "Medium", history)

        assert msg == "Good point. How does the event loop handle promises?"
        assert is_complete is False

        call_kwargs = mock_client.chat.completions.create.call_args[1]
        messages = call_kwargs["messages"]
        assert len(messages) == 3
        assert messages[1]["content"] == "What is an event loop?"
        assert messages[2]["content"] == "It allows JS to perform non-blocking I/O operations."

    @patch("services.llm_service.get_groq_client")
    def test_completion_marker_detected_and_stripped(self, mock_get_client):
        """When [INTERVIEW COMPLETE] is present, is_complete is True and phrase is stripped."""
        mock_client = MagicMock()
        mock_get_client.return_value = mock_client

        mock_resp = MagicMock()
        mock_resp.choices = [
            MagicMock(
                message=MagicMock(
                    content="Thank you for your time today! You did fantastic. [INTERVIEW COMPLETE]"
                )
            )
        ]
        mock_client.chat.completions.create.return_value = mock_resp

        msg, is_complete = llm_service.get_next_interviewer_message(
            "Go", "Hard", [{"role": "user", "content": "Finished all answers."}]
        )

        assert is_complete is True
        assert "[INTERVIEW COMPLETE]" not in msg
        assert msg == "Thank you for your time today! You did fantastic."


class TestGenerateInterviewReport:
    @patch("services.llm_service.get_groq_client")
    def test_generate_report_clean_json(self, mock_get_client):
        """Parses clean JSON successfully and passes temperature=0.3 and max_tokens=1000."""
        mock_client = MagicMock()
        mock_get_client.return_value = mock_client

        raw_json = json.dumps({
            "score": 92,
            "strengths": "Deep knowledge of database indexing. Answered B-Tree questions accurately.",
            "weaknesses": "Could be more concise when detailing lock escalation.",
            "revision_areas": "Lock escalation, isolation levels, MVCC",
            "verdict": "Candidate demonstrated strong backend database knowledge.",
            "recommendation": "Pass",
        })

        mock_resp = MagicMock()
        mock_resp.choices = [MagicMock(message=MagicMock(content=raw_json))]
        mock_client.chat.completions.create.return_value = mock_resp

        history = [
            {"role": "assistant", "content": "Explain B-Trees."},
            {"role": "user", "content": "B-Trees are self-balancing search trees for disk storage."},
        ]

        report = llm_service.generate_interview_report("SQL", "Hard", history)

        assert report["score"] == 92
        assert report["recommendation"] == "Pass"

        call_kwargs = mock_client.chat.completions.create.call_args[1]
        assert call_kwargs["temperature"] == 0.3
        assert call_kwargs["max_tokens"] == 1000
        assert call_kwargs["response_format"] == {"type": "json_object"}

    @patch("services.llm_service.get_groq_client")
    def test_generate_report_regex_fallback(self, mock_get_client):
        """Extracts JSON substring using regex fallback if response contains surrounding text/markdown."""
        mock_client = MagicMock()
        mock_get_client.return_value = mock_client

        markdown_wrapped = (
            "Here is the evaluation report based on the candidate's answers:\n"
            "```json\n"
            "{\n"
            '  "score": 45,\n'
            '  "strengths": "Understood the basic premise of Docker containers.",\n'
            '  "weaknesses": "Could not explain container namespaces or cgroups. Struggled with networking.",\n'
            '  "revision_areas": "Linux namespaces, cgroups, overlay networks",\n'
            '  "verdict": "Candidate lacks essential systems knowledge for this senior level.",\n'
            '  "recommendation": "Fail"\n'
            "}\n"
            "```\n"
            "End of evaluation."
        )

        mock_resp = MagicMock()
        mock_resp.choices = [MagicMock(message=MagicMock(content=markdown_wrapped))]
        mock_client.chat.completions.create.return_value = mock_resp

        report = llm_service.generate_interview_report(
            "DevOps", "Hard", [{"role": "user", "content": "Containers are light VMs."}]
        )

        assert report["score"] == 45
        assert report["recommendation"] == "Fail"
        assert "Linux namespaces" in report["revision_areas"]

    @patch("services.llm_service.get_groq_client")
    def test_generate_report_invalid_json_raises_value_error(self, mock_get_client):
        """Should raise ValueError if LLM response has no extractable JSON object."""
        mock_client = MagicMock()
        mock_get_client.return_value = mock_client

        mock_resp = MagicMock()
        mock_resp.choices = [
            MagicMock(message=MagicMock(content="I am unable to evaluate this transcript."))
        ]
        mock_client.chat.completions.create.return_value = mock_resp

        with pytest.raises(ValueError, match="No valid JSON object could be extracted"):
            llm_service.generate_interview_report("DevOps", "Easy", [])


class TestTopicValidation:
    """Comprehensive unit tests for topic validation (heuristics + LLM validation)."""

    def test_syntactically_invalid_topics(self):
        """Heuristic check rejects single chars, repeated chars, numbers, and known dummy words."""
        invalid_topics = [
            "",
            " ",
            "a",
            "123",
            "???",
            "aaaaa",
            "zzzzz",
            "lala",
            "xyz",
            "abc",
            "asdf",
            "qwerty",
            "test",
            "foo",
            "bar",
            "baz",
            "null",
        ]
        for topic in invalid_topics:
            assert llm_service.is_syntactically_invalid_topic(topic) is True, f"Failed for {topic}"
            assert llm_service.validate_interview_topic(topic) is False, f"Failed for {topic}"

    def test_syntactically_valid_topics(self):
        """Heuristic check accepts meaningful strings."""
        valid_topics = [
            "Python",
            "React",
            "Kubernetes",
            "System Design",
            "DSA",
            "pyton",
            "reack",
        ]
        for topic in valid_topics:
            assert llm_service.is_syntactically_invalid_topic(topic) is False, f"Failed for {topic}"

    @patch("services.llm_service.get_groq_client")
    def test_validate_interview_topic_llm_valid(self, mock_get_client):
        """validate_interview_topic returns True when LLM responds VALID."""
        mock_client = MagicMock()
        mock_get_client.return_value = mock_client
        mock_resp = MagicMock()
        mock_resp.choices = [MagicMock(message=MagicMock(content="VALID"))]
        mock_client.chat.completions.create.return_value = mock_resp

        assert llm_service.validate_interview_topic("pyton") is True

    @patch("services.llm_service.get_groq_client")
    def test_validate_interview_topic_llm_invalid(self, mock_get_client):
        """validate_interview_topic returns False when LLM responds INVALID."""
        mock_client = MagicMock()
        mock_get_client.return_value = mock_client
        mock_resp = MagicMock()
        mock_resp.choices = [MagicMock(message=MagicMock(content="INVALID"))]
        mock_client.chat.completions.create.return_value = mock_resp

        assert llm_service.validate_interview_topic("something_random_gibberish") is False

    @patch("services.llm_service.get_groq_client")
    def test_validate_interview_topic_llm_failure_fails_open(self, mock_get_client):
        """If LLM call fails, validator should fail open (return True) to avoid blocking users."""
        mock_client = MagicMock()
        mock_get_client.return_value = mock_client
        mock_client.chat.completions.create.side_effect = RuntimeError("Groq connection timeout")

        # Non-syntactically invalid topic should fail open
        assert llm_service.validate_interview_topic("Microservices Architecture") is True
