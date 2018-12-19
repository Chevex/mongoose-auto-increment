@Library('applifier-shared-libs@testing') _

Script {
  mongo = "3.6"
  disable_registry = "true"
  deploy = "script"
  //extraStepsPostStagingDeploy = ["scripts/publish-to-registry.groovy"]
  credentials = [
    "test": [
      "ARTIFACTORY_NPM_USER": "ARTIFACTORY_USER",
      "ARTIFACTORY_NPM_PASS": "ARTIFACTORY_PASS"
    ]
  ]
}
