FROM python:3.9-slim
WORKDIR /app
COPY requirements.txt ./
COPY app.py ./
COPY html/ ./html/
COPY db_schema.sql ./
COPY init_db.py ./
RUN mkdir -p /app/data
RUN pip install --no-cache-dir -r requirements.txt
# Create initial sqlite DB at build time (will also run at container start)
RUN python init_db.py || true

# Ensure the DB is initialized again at container start and then run the app
CMD ["/bin/sh", "-c", "python init_db.py && python app.py"]

