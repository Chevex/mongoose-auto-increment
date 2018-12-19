def main() {
  stage('Publish to npm registry') {
    sh '''
      docker run --rm ${DOCKER_PARAMS} \
      -e ARTIFACTORY_USER=${ARTIFACTORY_USER} \
      -e ARTIFACTORY_PASS=${ARTIFACTORY_PASS} \
      ${image} bash -c \
      'curl -u$ARTIFACTORY_USER:$ARTIFACTORY_PASS https://artifactory.internal.unity3d.com/api/npm/auth >> .npmrc \
        && npm publish'
      '''
  }
}

return this;
