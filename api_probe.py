from fastapi import FastAPI

app = FastAPI(title="SoulSul Probe")


@app.get("/")
def root():
    return {"status": "probe-ok"}


@app.get("/health")
def health():
    return {"status": "ok"}
