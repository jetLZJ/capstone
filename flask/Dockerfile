FROM python:3.9-slim

WORKDIR /app

# Keep Python output unbuffered
ENV PYTHONUNBUFFERED=1

# Install system packages required by Pillow, bcrypt and building optional wheels
RUN apt-get update \
	 && apt-get install -y --no-install-recommends \
		 build-essential \
		 libffi-dev \
		 libjpeg-dev \
		 zlib1g-dev \
	&& rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python deps
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy the whole flask module into the image
COPY . .

# Create runtime directories for the sqlite DB and uploaded files
RUN mkdir -p /app/data /app/static/uploads

# Create initial sqlite DB at build time (idempotent)
RUN python init_db.py || true

# Create an unprivileged user and ensure runtime directories are writable
RUN groupadd -r appuser && useradd -r -g appuser -d /home/appuser -m -s /usr/sbin/nologin appuser \
	&& chown -R appuser:appuser /app/data /app/static/uploads /app

ENV HOME=/home/appuser

# Expose default Flask port and run the app (init_db runs on start too)
EXPOSE 5000

# Run as non-root user
USER appuser

CMD ["/bin/sh", "-c", "python init_db.py && python app.py"]

# Healthcheck: probe the /health endpoint using Python (no curl dependency)
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
	CMD python -c "import sys,urllib.request as u; v=u.urlopen('http://127.0.0.1:5000/health', timeout=4); sys.exit(0 if v.getcode()==200 else 1)" || exit 1

