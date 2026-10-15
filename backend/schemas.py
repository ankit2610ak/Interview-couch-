from typing import Any, Dict, List
from pydantic import BaseModel, Field


class StartInterviewRequest(BaseModel):
    topic: str = Field(..., description="Technical topic for the interview", min_length=1)
    difficulty: str = Field(..., description="Difficulty level (e.g. Easy, Medium, Hard)", min_length=1)


class StartInterviewResponse(BaseModel):
    first_message: str
    conversation_history: List[Dict[str, Any]]


class AnswerRequest(BaseModel):
    topic: str = Field(..., description="Technical topic for the interview", min_length=1)
    difficulty: str = Field(..., description="Difficulty level", min_length=1)
    user_answer: str = Field(..., description="Candidate's answer text", min_length=1)
    conversation_history: List[Dict[str, Any]] = Field(
        ...,
        description="Prior conversation history list",
    )


class AnswerResponse(BaseModel):
    ai_message: str
    is_complete: bool
    conversation_history: List[Dict[str, Any]]


class ReportRequest(BaseModel):
    topic: str = Field(..., description="Technical topic of the interview", min_length=1)
    difficulty: str = Field(..., description="Difficulty level", min_length=1)
    conversation_history: List[Dict[str, Any]] = Field(
        ...,
        description="Full conversation history transcript",
    )
