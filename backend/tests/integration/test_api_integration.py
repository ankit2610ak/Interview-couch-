import os
from unittest.mock import MagicMock, patch
import pytest
from fastapi.testclient import TestClient

_groq_key = os.getenv("GROQ_API_KEY", "")
GROQ_API_KEY_PRESENT = bool(_groq_key) and _groq_key not in ("your_groq_api_key_here",)


class TestFullInterviewWorkflowIntegration:
    """End-to-end integration tests simulating complete interview user journeys."""

    @patch("services.llm_service.get_groq_client")
    def test_full_mocked_interview_to_report_flow(self, mock_get_client, client: TestClient):
        """Complete deterministic multi-turn interview workflow: start -> answer 1 -> answer 2 (conclude) -> generate report."""
        mock_client = MagicMock()
        mock_get_client.return_value = mock_client

        # Turn 1: Opening question
        resp1 = MagicMock()
        resp1.choices = [
            MagicMock(
                message=MagicMock(
                    content="Welcome! To start off, could you explain the difference between processes and threads in an OS?"
                )
            )
        ]

        # Turn 2: Follow-up question
        resp2 = MagicMock()
        resp2.choices = [
            MagicMock(
                message=MagicMock(
                    content="Good explanation regarding shared memory. How does thread synchronization prevent race conditions?"
                )
            )
        ]

        # Turn 3: Concluding question
        resp3 = MagicMock()
        resp3.choices = [
            MagicMock(
                message=MagicMock(
                    content="Understood. Thank you for thoroughly discussing mutexes and semaphores! [INTERVIEW COMPLETE]"
                )
            )
        ]

        # Turn 4: Final evaluation report
        report_json = (
            "{\n"
            '  "score": 88,\n'
            '  "strengths": "Clearly articulated the distinction between memory spaces of processes and threads. Demonstrated solid comprehension of mutual exclusion primitives.",\n'
            '  "weaknesses": "Could provide more concrete details about deadlock prevention conditions.",\n'
            '  "revision_areas": "Deadlock prevention, lock-free programming, condition variables",\n'
            '  "verdict": "Candidate displayed strong foundational systems programming knowledge and answered coherently under probing.",\n'
            '  "recommendation": "Pass"\n'
            "}"
        )
        resp4 = MagicMock()
        resp4.choices = [MagicMock(message=MagicMock(content=report_json))]

        mock_client.chat.completions.create.side_effect = [resp1, resp2, resp3, resp4]

        # Step 1: Start Interview
        start_res = client.post(
            "/api/interview/start",
            json={"topic": "Operating Systems", "difficulty": "Medium"},
        )
        assert start_res.status_code == 200
        start_data = start_res.json()
        assert "difference between processes and threads" in start_data["first_message"]
        history = start_data["conversation_history"]
        assert len(history) == 1

        # Step 2: Answer first question
        ans1_res = client.post(
            "/api/interview/answer",
            json={
                "topic": "Operating Systems",
                "difficulty": "Medium",
                "user_answer": "Processes have independent address spaces, while threads share the process memory heap.",
                "conversation_history": history,
            },
        )
        assert ans1_res.status_code == 200
        ans1_data = ans1_res.json()
        assert ans1_data["is_complete"] is False
        assert "thread synchronization" in ans1_data["ai_message"]
        history = ans1_data["conversation_history"]
        assert len(history) == 3

        # Step 3: Answer second question (triggers conclusion)
        ans2_res = client.post(
            "/api/interview/answer",
            json={
                "topic": "Operating Systems",
                "difficulty": "Medium",
                "user_answer": "Thread synchronization uses locks, mutexes, and semaphores to coordinate critical section access.",
                "conversation_history": history,
            },
        )
        assert ans2_res.status_code == 200
        ans2_data = ans2_res.json()
        assert ans2_data["is_complete"] is True
        assert "[INTERVIEW COMPLETE]" not in ans2_data["ai_message"]
        history = ans2_data["conversation_history"]
        assert len(history) == 5

        # Step 4: Generate evaluation report
        report_res = client.post(
            "/api/report/generate",
            json={
                "topic": "Operating Systems",
                "difficulty": "Medium",
                "conversation_history": history,
            },
        )
        assert report_res.status_code == 200
        report_data = report_res.json()
        assert report_data["score"] == 88
        assert report_data["recommendation"] == "Pass"
        assert "mutexes" in report_data["strengths"].lower() or "memory" in report_data["strengths"].lower()
        assert "Deadlock prevention" in report_data["revision_areas"]

    @pytest.mark.skipif(not GROQ_API_KEY_PRESENT, reason="Live Groq API test requires GROQ_API_KEY")
    def test_live_groq_api_interview_flow(self, client: TestClient):
        """Live integration test against the Groq API verifying real end-to-end communication."""
        # 1. Start live interview
        start_res = client.post(
            "/api/interview/start",
            json={"topic": "Python", "difficulty": "Easy"},
        )
        assert start_res.status_code == 200
        start_data = start_res.json()
        assert isinstance(start_data["first_message"], str)
        assert len(start_data["first_message"]) > 10
        history = start_data["conversation_history"]
        assert len(history) == 1
        assert history[0]["role"] == "assistant"

        # 2. Answer live interview question
        ans_res = client.post(
            "/api/interview/answer",
            json={
                "topic": "Python",
                "difficulty": "Easy",
                "user_answer": "A list in Python is an ordered mutable collection, while a tuple is an immutable collection.",
                "conversation_history": history,
            },
        )
        assert ans_res.status_code == 200
        ans_data = ans_res.json()
        assert isinstance(ans_data["ai_message"], str)
        assert len(ans_data["ai_message"]) > 10
        assert isinstance(ans_data["is_complete"], bool)
        updated_history = ans_data["conversation_history"]
        assert len(updated_history) == 3

        # 3. Generate live report
        report_res = client.post(
            "/api/report/generate",
            json={
                "topic": "Python",
                "difficulty": "Easy",
                "conversation_history": updated_history,
            },
        )
        assert report_res.status_code == 200
        report_data = report_res.json()
        assert "score" in report_data
        assert 0 <= report_data["score"] <= 100
        assert report_data["recommendation"] in ("Pass", "Fail")
        assert isinstance(report_data["strengths"], str)
        assert isinstance(report_data["weaknesses"], str)
        assert isinstance(report_data["revision_areas"], str)
        assert isinstance(report_data["verdict"], str)
