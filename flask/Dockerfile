FROM python:3.9-slim
WORKDIR /app
COPY requirements.txt ./
COPY app.py ./
COPY html/ ./html/
RUN pip install --no-cache-dir -r requirements.txt

