FROM python:3.12-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg chromium fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/* && useradd -m -u 1000 studio
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . /app
USER studio
ENV STUDIO_DATA=/data STUDIO_AUTOPROCESS=1 HF_HOME=/data/.modeles
WORKDIR /app/server
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8765", "--proxy-headers"]
