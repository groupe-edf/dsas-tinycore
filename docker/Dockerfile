FROM scratch
ENV CONTAINER=dsas
ADD rootfs64.tar.gz /

RUN ldconfig

EXPOSE 22 161 443 5000
USER root
CMD ["/bin/sh"]
#ENTRYPOINT /etc/init.d/services/dsas start
