from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List
import os

app = FastAPI(title="BGE-M3 Embedding Service")

_model = None


def get_model():
    global _model
    if _model is None:
        from sentence_transformers import SentenceTransformer
        _model = SentenceTransformer("BAAI/bge-m3")
    return _model


class EmbedRequest(BaseModel):
    text: str


class EmbedBatchRequest(BaseModel):
    texts: List[str]


class EmbedResponse(BaseModel):
    embedding: List[float]


class EmbedBatchResponse(BaseModel):
    embeddings: List[List[float]]


@app.get("/health")
async def health():
    return {"status": "ok", "model": "BAAI/bge-m3"}


@app.post("/embed", response_model=EmbedResponse)
async def embed(req: EmbedRequest):
    try:
        model = get_model()
        embedding = model.encode(req.text, normalize_embeddings=True)
        return EmbedResponse(embedding=embedding.tolist())
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/embed_batch", response_model=EmbedBatchResponse)
async def embed_batch(req: EmbedBatchRequest):
    try:
        model = get_model()
        embeddings = model.encode(req.texts, normalize_embeddings=True, batch_size=32)
        return EmbedBatchResponse(embeddings=embeddings.tolist())
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
