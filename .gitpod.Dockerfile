FROM gitpod/workspace-full

RUN curl https://sh.rustup.rs -sSf | sh -s -- -y
ENV PATH="/home/gitpod/.cargo/bin:${PATH}"