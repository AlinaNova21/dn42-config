FROM alpine
RUN apk add --no-cache --repository http://dl-3.alpinelinux.org/alpine/edge/testing/ wireguard-tools
RUN apk add --no-cache util-linux iproute2 tcpdump
CMD ["sh","-c","while true; do sleep 40000; done"]