# Tool payload only: this image must run inside a CORNOD guest microVM,
# never as the tenant-to-host isolation boundary.
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

RUN apt-get update \
    && apt-get install --no-install-recommends -y ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Pin the upstream Sherlock release; review and update deliberately.
RUN python -m pip install --no-cache-dir --no-compile "sherlock-project==0.16.2"

RUN useradd --create-home --uid 10001 --shell /usr/sbin/nologin cornod \
    && install -d -o cornod -g cornod /workspace/results

COPY --chown=root:root run_sherlock.py /usr/local/bin/cornod-sherlock
RUN chmod 0555 /usr/local/bin/cornod-sherlock

USER 10001:10001
WORKDIR /workspace/results
ENTRYPOINT ["/usr/local/bin/cornod-sherlock"]
