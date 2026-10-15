from unittest.mock import patch
from typing import Any, Dict, List
from fastapi.testclient import TestClient


class TestReportRouter:
    @patch("routers.report.generate_interview_report")
    def test_generate_report_success(
        self,
        mock_gen_report,
        client: TestClient,
        sample_conversation_history: List[Dict[str, str]],
        sample_report_payload: Dict[str, Any],
    ):
        """POST /api/report/generate successfully delegates to service and returns report JSON."""
        mock_gen_report.return_value = sample_report_payload

        payload = {
            "topic": "Python",
            "difficulty": "Medium",
            "conversation_history": sample_conversation_history,
        }

        response = client.post("/api/report/generate", json=payload)

        assert response.status_code == 200
        data = response.json()
        assert data["score"] == 85
        assert data["recommendation"] == "Pass"
        assert "Demonstrated solid understanding" in data["strengths"]
        assert "Memory optimization" in data["revision_areas"]

        mock_gen_report.assert_called_once_with(
            topic="Python",
            difficulty="Medium",
            conversation_history=sample_conversation_history,
        )

    def test_generate_report_validation_missing_history(self, client: TestClient):
        """POST /api/report/generate returns 422 when conversation_history is missing."""
        payload = {"topic": "SQL", "difficulty": "Hard"}
        response = client.post("/api/report/generate", json=payload)
        assert response.status_code == 422

    def test_generate_report_validation_missing_topic(self, client: TestClient):
        """POST /api/report/generate returns 422 when topic is missing."""
        payload = {
            "difficulty": "Easy",
            "conversation_history": [{"role": "user", "content": "test"}],
        }
        response = client.post("/api/report/generate", json=payload)
        assert response.status_code == 422

    @patch("routers.report.generate_interview_report")
    def test_generate_report_service_error_returns_500(self, mock_gen_report, client: TestClient):
        """POST /api/report/generate returns 500 when report generation fails."""
        mock_gen_report.side_effect = ValueError("Could not parse JSON report")

        payload = {
            "topic": "Kubernetes",
            "difficulty": "Hard",
            "conversation_history": [
                {"role": "user", "content": "Kubelet manages pods on a node."}
            ],
        }

        response = client.post("/api/report/generate", json=payload)

        assert response.status_code == 500
        assert "Could not parse JSON report" in response.json()["detail"]
