import pytest
from pydantic import ValidationError
from schemas import (
    StartInterviewRequest,
    StartInterviewResponse,
    AnswerRequest,
    AnswerResponse,
    ReportRequest,
)


class TestSchemas:
    def test_start_interview_request_valid(self):
        req = StartInterviewRequest(topic="Python", difficulty="Easy")
        assert req.topic == "Python"
        assert req.difficulty == "Easy"

    def test_start_interview_request_empty_invalid(self):
        with pytest.raises(ValidationError):
            StartInterviewRequest(topic="", difficulty="Easy")

    def test_answer_request_valid(self):
        req = AnswerRequest(
            topic="Algorithms",
            difficulty="Hard",
            user_answer="Dijkstra uses a priority queue.",
            conversation_history=[{"role": "assistant", "content": "Explain shortest path."}],
        )
        assert req.topic == "Algorithms"
        assert req.user_answer == "Dijkstra uses a priority queue."
        assert len(req.conversation_history) == 1

    def test_answer_request_missing_history_raises(self):
        with pytest.raises(ValidationError):
            AnswerRequest(
                topic="Algorithms",
                difficulty="Medium",
                user_answer="Binary search runs in O(log n).",
            )

    def test_report_request_valid(self):
        req = ReportRequest(
            topic="System Design",
            difficulty="Hard",
            conversation_history=[
                {"role": "assistant", "content": "How would you design Twitter?"},
                {"role": "user", "content": "I would use a fan-out architecture."},
            ],
        )
        assert req.topic == "System Design"
        assert len(req.conversation_history) == 2

    def test_report_request_missing_history_raises(self):
        with pytest.raises(ValidationError):
            ReportRequest(topic="System Design", difficulty="Hard")

    def test_responses_valid(self):
        start_res = StartInterviewResponse(
            first_message="Hello!",
            conversation_history=[{"role": "assistant", "content": "Hello!"}],
        )
        assert start_res.first_message == "Hello!"

        ans_res = AnswerResponse(
            ai_message="Good answer.",
            is_complete=False,
            conversation_history=[],
        )
        assert ans_res.is_complete is False
