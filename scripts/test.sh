#! /usr/bin/env bash

docker run --rm ${DOCKER_PARAMS} \
  --name ${service}_test_${identifier} \
  ${image} bash -c \
  'npm install && npm test'
