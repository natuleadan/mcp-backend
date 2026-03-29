import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { registerRunBaseSeedTool } from './tools/run-base-seed.tools.js'
import { registerRunDataSeedTool } from './tools/run-data-seed.tools.js'
import { registerRunAllSeedsTool } from './tools/run-all-seeds.tools.js'
import { registerListSeedFilesTool } from './tools/list-seed-files.tools.js'
import { registerQueryDbTool } from './tools/query-db.tools.js'
import { registerListTablesTool } from './tools/list-tables.tools.js'
import { registerExecuteSqlTool } from './tools/execute-sql.tools.js'
import { registerExecuteRlsSqlTool } from './tools/execute-rls-sql.tools.js'
import { registerListBucketsTool } from './tools/list-buckets.tools.js'
import { registerListFilesTool } from './tools/list-files.tools.js'
import { registerUploadFileTool } from './tools/upload-file.tools.js'
import { registerDeleteFileTool } from './tools/delete-file.tools.js'
import { registerGetSignedUrlTool } from './tools/get-signed-url.tools.js'
import { registerGetPublicUrlTool } from './tools/get-public-url.tools.js'
import { registerDownloadBucketTool } from './tools/download-bucket.tools.js'
import { registerListIcebergTablesTool } from './tools/list-iceberg-tables.tools.js'
import { registerQueryIcebergTool } from './tools/query-iceberg.tools.js'
import { registerListIcebergCatalogTablesTool } from './tools/list-iceberg-catalog-tables.tools.js'
import { registerBootstrapIcebergTool } from './tools/bootstrap-iceberg.tools.js'
import { registerTableInfoTool } from './tools/table-info.tools.js'
import { registerColumnStatsTool } from './tools/column-stats.tools.js'
import { registerValidateSqlTool } from './tools/validate-sql.tools.js'
import { registerQueryWithExplainTool } from './tools/query-with-explain.tools.js'
import { registerActiveQueriesTool } from './tools/active-queries.tools.js'
import { registerDatabaseStatsTool } from './tools/database-stats.tools.js'
import { registerIndexInfoTool } from './tools/index-info.tools.js'
import { registerBulkUploadFilesTool } from './tools/bulk-upload-files.tools.js'
import { registerCallRpcTool } from './tools/call-rpc.tools.js'
import { registerExecuteSqlFileTool } from './tools/execute-sql-file.tools.js'
import { registerGenerateAndUpdateSignedUrlTool } from './tools/generate-and-update-signed-url.tools.js'

const server = new McpServer({
  name: 'mcp-backend',
  version: '1.0.0',
})

// Register refactored legacy tools (function-based)
registerRunBaseSeedTool(server)
registerRunDataSeedTool(server)
registerRunAllSeedsTool(server)
registerListSeedFilesTool(server)
registerQueryDbTool(server)
registerListTablesTool(server)
registerExecuteSqlTool(server)
registerExecuteRlsSqlTool(server)
registerListBucketsTool(server)
registerListFilesTool(server)
registerUploadFileTool(server)
registerDeleteFileTool(server)
registerGetSignedUrlTool(server)
registerGetPublicUrlTool(server)
registerDownloadBucketTool(server)
registerListIcebergTablesTool(server)
registerQueryIcebergTool(server)
registerListIcebergCatalogTablesTool(server)
registerBootstrapIcebergTool(server)

// Register new tools (function-based)
registerTableInfoTool(server)
registerColumnStatsTool(server)
registerValidateSqlTool(server)
registerQueryWithExplainTool(server)
registerActiveQueriesTool(server)
registerDatabaseStatsTool(server)
registerIndexInfoTool(server)
registerBulkUploadFilesTool(server)
registerCallRpcTool(server)
registerExecuteSqlFileTool(server)
registerGenerateAndUpdateSignedUrlTool(server)

const transport = new StdioServerTransport()
await server.connect(transport)
console.error('mcp-backend running with 30 tools (20 legacy + 10 new)')
