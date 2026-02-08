from fastapi import FastAPI
from mangum import Mangum

app = FastAPI()

@app.get("/")
def root():
    return {"message": "Hola desde FastAPI en Netlify"}

@app.get("/users/{user_id}")
def get_user(user_id: int):
    return {"user_id": user_id}

handler = Mangum(app)
