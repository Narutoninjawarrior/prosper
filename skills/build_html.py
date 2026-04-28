import os
import sys

# Paths
md_path = r"d:\prosper\COTTAGE_COMMONS_WHITEPAPER.md"
html_path = r"d:\prosper\COTTAGE_COMMONS_WHITEPAPER.html"

# Read markdown
with open(md_path, 'r', encoding='utf-8') as f:
    md_content = f.read()

# Escape backticks and backslashes for JS string injection
escaped_md = md_content.replace('\\', '\\\\').replace('`', '\\`').replace('$', '\\$')

# HTML template using marked.js and github-markdown-css
html_template = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Cottage Commons Whitepaper</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/github-markdown-css/5.2.0/github-markdown.min.css">
    <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
    <style>
        body {{
            box-sizing: border-box;
            min-width: 200px;
            max-width: 980px;
            margin: 0 auto;
            padding: 45px;
            background-color: white;
            color: black;
        }}
        @media (max-width: 767px) {{
            body {{
                padding: 15px;
            }}
        }}
        @media print {{
            body {{
                max-width: none;
                padding: 0;
            }}
            .markdown-body {{
                font-family: Arial, sans-serif, -apple-system;
            }}
            .markdown-body pre, .markdown-body code {{
                white-space: pre-wrap;
                word-wrap: break-word;
            }}
        }}
    </style>
</head>
<body class="markdown-body">
    <div id="content"></div>
    <script>
        const rawMarkdown = `{escaped_md}`;
        document.getElementById('content').innerHTML = marked.parse(rawMarkdown);
        
        // Auto-print after 1 second to ensure rendering
        setTimeout(() => {{
            window.print();
        }}, 1000);
    </script>
</body>
</html>
"""

with open(html_path, 'w', encoding='utf-8') as f:
    f.write(html_template)

print("HTML generated successfully.")
