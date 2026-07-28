@description('Environment name: dev, staging, prod')
param environmentName string = 'dev'

@description('Azure region')
param location string = resourceGroup().location

@description('Application name prefix')
param appName string = 'digi-switchride'

var namePrefix = '${appName}-${environmentName}'
var tags = {
  environment: environmentName
  project: 'digi-switchride'
}

resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: '${namePrefix}-logs'
  location: location
  tags: tags
  properties: {
    sku: { name: 'PerGB2018' }
    retentionInDays: 30
  }
}

resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: '${namePrefix}-appinsights'
  location: location
  tags: tags
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logAnalytics.id
  }
}

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: '${replace(namePrefix, '-', '')}kv'
  location: location
  tags: tags
  properties: {
    sku: { family: 'A', name: 'standard' }
    tenantId: subscription().tenantId
    enableRbacAuthorization: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 7
  }
}

resource storageAccount 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: '${replace(namePrefix, '-', '')}st'
  location: location
  tags: tags
  sku: { name: 'Standard_LRS' }
  kind: 'StorageV2'
  properties: {
    accessTier: 'Hot'
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
    allowBlobPublicAccess: false
  }
}

resource cosmosAccount 'Microsoft.DocumentDB/databaseAccounts@2023-11-15' = {
  name: '${replace(namePrefix, '-', '')}mongo'
  location: location
  tags: tags
  kind: 'MongoDB'
  properties: {
    databaseAccountOfferType: 'Standard'
    locations: [{ locationName: location, failoverPriority: 0, isZoneRedundant: false }]
    apiProperties: { serverVersion: '7.0' }
  }
}

resource cosmosDatabase 'Microsoft.DocumentDB/databaseAccounts/mongodbDatabases@2023-11-15' = {
  parent: cosmosAccount
  name: 'switchride'
  properties: { resource: { id: 'switchride' } }
}

resource redis 'Microsoft.Cache/redis@2023-08-01' = {
  name: '${namePrefix}-redis'
  location: location
  tags: tags
  properties: {
    sku: {
      name: environmentName == 'prod' ? 'Standard' : 'Basic'
      family: 'C'
      capacity: environmentName == 'prod' ? 1 : 0
    }
    enableNonSslPort: false
    minimumTlsVersion: '1.2'
  }
}

resource appServicePlan 'Microsoft.Web/serverfarms@2023-01-01' = {
  name: '${namePrefix}-plan'
  location: location
  tags: tags
  sku: {
    name: environmentName == 'prod' ? 'P1v3' : 'B1'
    tier: environmentName == 'prod' ? 'PremiumV3' : 'Basic'
  }
  properties: { reserved: true }
}

resource appService 'Microsoft.Web/sites@2023-01-01' = {
  name: '${namePrefix}-api'
  location: location
  tags: tags
  kind: 'app,linux'
  identity: { type: 'SystemAssigned' }
  properties: {
    serverFarmId: appServicePlan.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'NODE|20-lts'
      alwaysOn: environmentName != 'dev'
      appSettings: [
        { name: 'PORT', value: '8080' }
        { name: 'NODE_ENV', value: environmentName }
        { name: 'APPLICATIONINSIGHTS_CONNECTION_STRING', value: appInsights.properties.ConnectionString }
        { name: 'MONGODB_URI', value: 'mongodb://${cosmosAccount.name}:${listKeys(cosmosAccount.id, cosmosAccount.apiVersion).primaryMasterKey}@${cosmosAccount.name}.mongo.cosmos.azure.com:10255/switchride?ssl=true&replicaSet=globaldb' }
      ]
    }
  }
}

resource iotHub 'Microsoft.Devices/IotHubs@2023-06-30' = {
  name: '${namePrefix}-iothub'
  location: location
  tags: tags
  sku: {
    name: environmentName == 'prod' ? 'S1' : 'F1'
    capacity: 1
  }
  properties: {}
}

resource apim 'Microsoft.ApiManagement/service@2023-05-01-preview' = {
  name: '${namePrefix}-apim'
  location: location
  tags: tags
  sku: {
    name: environmentName == 'prod' ? 'Standard' : 'Developer'
    capacity: environmentName == 'prod' ? 1 : 0
  }
  properties: {
    publisherEmail: 'admin@digi-switchride.com'
    publisherName: 'Digi-Switchride'
  }
}

output apiUrl string = 'https://${appService.properties.defaultHostName}'
output apimGatewayUrl string = apim.properties.gatewayUrl
output cosmosAccountName string = cosmosAccount.name
output redisHost string = redis.properties.hostName
output storageAccountName string = storageAccount.name
output iotHubHostName string = iotHub.properties.hostName
output keyVaultName string = keyVault.name
