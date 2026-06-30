const fs = require('fs');
const path = require('path');

// 1. Fix llms.txt
const llmsFile = path.join(__dirname, 'frontend', 'public', 'llms.txt');
let llms = fs.readFileSync(llmsFile, 'utf8');
llms = llms.replace(/seven read-only tools on page load:/g, '22 tools on page load (15 read-only, 7 write-capable):');
llms = llms.replace(/seven read-only tools over the registry/g, '22 tools over the registry');
fs.writeFileSync(llmsFile, llms);

// 2. Fix ai.json
const aiFile = path.join(__dirname, 'frontend', 'public', '.well-known', 'ai.json');
let ai = fs.readFileSync(aiFile, 'utf8');
// Assuming we want to update the tools list to say 22 tools. 
// It currently has an array of tools: "hearthlands_vessel_brief", "hearthlands_list_registries", ...
// Let's just let ai.json be as it is if it just lists the tools, wait, let's see how many tools are there.
const aiData = JSON.parse(ai);
const mcpTools = aiData.mcp.tools;
if (mcpTools.length < 22) {
    aiData.mcp.tools = [
        "hearthlands_vessel_brief",
        "hearthlands_stability_compass",
        "hearthlands_list_registries",
        "hearthlands_search_registry",
        "hearthlands_get_record",
        "hearthlands_world_summary",
        "hearthlands_council_latest",
        "hearthlands_validate_blueprint",
        "hearthlands_receipts_query",
        "hearthlands_world_oracle",
        "hearthlands_agent_passport",
        "hearthlands_seed_vault",
        "hearthlands_budget_reserve",
        "hearthlands_budget_commit",
        "hearthlands_budget_release",
        "hearthlands_agent_health",
        "hearthlands_registry_list",
        "hearthlands_inspire",
        "hearthlands_resonance_create",
        "hearthlands_resonance_join",
        "hearthlands_resonance_contribute",
        "hearthlands_economy_health"
    ];
    fs.writeFileSync(aiFile, JSON.stringify(aiData, null, 2));
}

// 3. Fix mcpServer.ts
const mcpFile = path.join(__dirname, 'functions', 'src', 'mcpServer.ts');
let mcp = fs.readFileSync(mcpFile, 'utf8');
mcp = mcp.replace(
  "policy: 'All MCP tools are read-only. Separate authenticated or beta server APIs may append logs or identity links, and those are documented outside the MCP surface.',",
  "policy: 'The MCP server exposes 22 tools: 15 read-only discovery tools and 7 write-capable economic/collaborative tools (which require Auth and/or EMBER). Check readOnlyHint in tools/list.',"
);
mcp = mcp.replace(
  "All tools are READ-ONLY and reuse the exact helpers behind the",
  "Tools are mixed (15 read-only, 7 write-capable) and reuse the exact helpers behind the"
);
mcp = mcp.replace(
  "All tools are read-only; there are no write paths, wallets, or purchases.",
  "The server exposes 15 read-only tools and 7 write-capable tools (some require Auth and/or EMBER)."
);
fs.writeFileSync(mcpFile, mcp);

console.log('Fixed truth gaps about MCP tools');
