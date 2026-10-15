from unittest.mock import patch
import pytest
from fastapi.testclient import TestClient


class TestInterviewStartEndpoint:
    @patch("routers.interview.get_next_interviewer_message")
    def test_start_interview_success(self, mock_get_msg, client: TestClient):
        """POST /api/interview/start successfully creates initial question and history."""
        mock_get_msg.return_value = ("What is the difference between let and const in JavaScript?", False)

        payload = {"topic": "JavaScript", "difficulty": "Easy"}
        response = client.post("/api/interview/start", json=payload)

        assert response.status_code == 200
        data = response.json()
        assert data["first_message"] == "What is the difference between let and const in JavaScript?"
        assert "conversation_history" in data
        assert len(data["conversation_history"]) == 1
        assert data["conversation_history"][0] == {
            "role": "assistant",
            "content": "What is the difference between let and const in JavaScript?",
        }
        mock_get_msg.assert_called_once_with(
            topic="JavaScript",
            difficulty="Easy",
            conversation_history=[],
        )

    def test_start_interview_validation_missing_topic(self, client: TestClient):
        """POST /api/interview/start returns 422 when required fields are missing."""
        response = client.post("/api/interview/start", json={"difficulty": "Easy"})
        assert response.status_code == 422

    def test_start_interview_validation_missing_difficulty(self, client: TestClient):
        """POST /api/interview/start returns 422 when difficulty is missing."""
        response = client.post("/api/interview/start", json={"topic": "React"})
        assert response.status_code == 422

    @patch("routers.interview.get_next_interviewer_message")
    def test_start_interview_service_exception_returns_500(self, mock_get_msg, client: TestClient):
        """POST /api/interview/start returns 500 when upstream service raises error."""
        mock_get_msg.side_effect = RuntimeError("Groq API service unavailable")

        payload = {"topic": "Python", "difficulty": "Medium"}
        response = client.post("/api/interview/start", json=payload)

        assert response.status_code == 500
        assert "Groq API service unavailable" in response.json()["detail"]


class TestInterviewAnswerEndpoint:
    @patch("routers.interview.get_next_interviewer_message")
    def test_answer_interview_success(self, mock_get_msg, client: TestClient):
        """POST /api/interview/answer appends user answer, gets AI question, and returns updated history."""
        mock_get_msg.return_value = (
            "Good point on immutability. Can you explain closures?",
            False,
        )

        initial_history = [
            {"role": "assistant", "content": "What is a closure in JS?"}
        ]

        payload = {
            "topic": "JavaScript",
            "difficulty": "Medium",
            "user_answer": "A closure gives an inner function access to its outer function scope.",
            "conversation_history": initial_history,
        }

        response = client.post("/api/interview/answer", json=payload)

        assert response.status_code == 200
        data = response.json()
        assert data["ai_message"] == "Good point on immutability. Can you explain closures?"
        assert data["is_complete"] is False
        assert len(data["conversation_history"]) == 3

        # Verify sequential history order
        assert data["conversation_history"][0] == initial_history[0]
        assert data["conversation_history"][1] == {
            "role": "user",
            "content": "A closure gives an inner function access to its outer function scope.",
        }
        assert data["conversation_history"][2] == {
            "role": "assistant",
            "content": "Good point on immutability. Can you explain closures?",
        }

    @patch("routers.interview.get_next_interviewer_message")
    def test_answer_interview_completed_session(self, mock_get_msg, client: TestClient):
        """POST /api/interview/answer sets is_complete=True when AI concludes the interview."""
        mock_get_msg.return_value = (
            "That concludes all our technical topics for today. Excellent performance!",
            True,
        )

        payload = {
            "topic": "System Design",
            "difficulty": "Hard",
            "user_answer": "We can use consistent hashing to distribute loads across partitions.",
            "conversation_history": [
                {"role": "assistant", "content": "How do you handle partition rebalancing?"}
            ],
        }

        response = client.post("/api/interview/answer", json=payload)

        assert response.status_code == 200
        data = response.json()
        assert data["is_complete"] is True
        assert "That concludes all our technical topics" in data["ai_message"]

    def test_answer_interview_validation_missing_answer(self, client: TestClient):
        """POST /api/interview/answer returns 422 if user_answer is missing."""
        payload = {
            "topic": "Rust",
            "difficulty": "Hard",
            "conversation_history": [],
        }
        response = client.post("/api/interview/answer", json=payload)
        assert response.status_code == 422

    @patch("routers.interview.get_next_interviewer_message")
    def test_answer_interview_exception_returns_500(self, mock_get_msg, client: TestClient):
        """POST /api/interview/answer returns 500 when service raises an error."""
        mock_get_msg.side_effect = ValueError("Rate limit exceeded")

        payload = {
            "topic": "Python",
            "difficulty": "Easy",
            "user_answer": "Sample answer",
            "conversation_history": [],
        }
        response = client.post("/api/interview/answer", json=payload)

        assert response.status_code == 500
        assert "Rate limit exceeded" in response.json()["detail"]
