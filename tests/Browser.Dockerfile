FROM mcr.microsoft.com/playwright/python:v1.55.0-noble
RUN pip install --no-cache-dir playwright==1.55.0
WORKDIR /suite
COPY browser_flow.py http_contract.py ./
CMD ["python", "browser_flow.py"]
