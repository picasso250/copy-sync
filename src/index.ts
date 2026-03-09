export interface Env {
	COPY_KV: KVNamespace;
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);
		const path = url.pathname.slice(1);

		// 处理 API 请求
		if (path.startsWith('api/')) {
			const name = path.slice(4);
			if (request.method === 'GET') {
				const value = await env.COPY_KV.get(name);
				return new Response(value || "", { headers: { "content-type": "text/plain;charset=UTF-8" } });
			}
			if (request.method === 'POST') {
				const text = await request.text();
				await env.COPY_KV.put(name, text, { expirationTtl: 86400 * 30 }); // 存储 30 天
				return new Response("Saved", { status: 200 });
			}
		}

		// 返回前端页面
		const name = path || "default";
		const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Clip - ${name}</title>
    <style>
        body { font-family: -apple-system, system-ui, sans-serif; padding: 20px; background: #f4f4f9; display: flex; flex-direction: column; align-items: center; }
        .container { width: 100%; max-width: 600px; background: white; padding: 20px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        h1 { font-size: 1.5rem; margin-bottom: 20px; color: #333; }
        textarea { width: 100%; height: 300px; padding: 15px; border: 1px solid #ddd; border-radius: 8px; font-size: 1rem; box-sizing: border-box; resize: vertical; margin-bottom: 10px; }
        .status { font-size: 0.8rem; color: #888; margin-top: -5px; height: 1.2rem; }
        .controls { display: flex; justify-content: space-between; align-items: center; width: 100%; }
        button { background: #007aff; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-size: 0.9rem; }
        button:hover { background: #0056b3; }
        .copy-btn { background: #34c759; }
        .copy-btn:hover { background: #28a745; }
    </style>
</head>
<body>
    <div class="container">
        <div class="controls">
            <h1>/${name}</h1>
            <button class="copy-btn" onclick="copyText()">复制全部</button>
        </div>
        <textarea id="editor" placeholder="在这里输入文字..."></textarea>
        <div class="status" id="status">正在同步...</div>
    </div>

    <script>
        const editor = document.getElementById('editor');
        const status = document.getElementById('status');
        const name = "${name}";
        let timer;

        // 加载初始内容
        async function loadContent() {
            try {
                const res = await fetch(\`/api/\${name}\`);
                editor.value = await res.text();
                status.innerText = "已同步最新内容";
            } catch (e) {
                status.innerText = "同步失败";
            }
        }

        // 保存内容 (Debounce 1s)
        function saveContent() {
            status.innerText = "正在保存...";
            clearTimeout(timer);
            timer = setTimeout(async () => {
                try {
                    await fetch(\`/api/\${name}\`, {
                        method: 'POST',
                        body: editor.value
                    });
                    status.innerText = "已保存至 KV (有效期30天)";
                    setTimeout(() => {
                        if (status.innerText === "已保存至 KV (有效期30天)") status.innerText = "等待输入...";
                    }, 2000);
                } catch (e) {
                    status.innerText = "保存失败";
                }
            }, 1000);
        }

        // 复制功能
        function copyText() {
            editor.select();
            document.execCommand('copy');
            const originalText = document.querySelector('.copy-btn').innerText;
            document.querySelector('.copy-btn').innerText = "已复制!";
            setTimeout(() => {
                document.querySelector('.copy-btn').innerText = originalText;
            }, 2000);
        }

        editor.addEventListener('input', saveContent);
        loadContent();
        
        // 轮询检查是否有更新 (简单同步)
        setInterval(async () => {
            if (document.activeElement !== editor) {
                const res = await fetch(\`/api/\${name}\`);
                const text = await res.text();
                if (text !== editor.value) {
                    editor.value = text;
                    status.innerText = "内容已由其他设备更新";
                }
            }
        }, 5000);
    </script>
</body>
</html>`;
		return new Response(html, { headers: { "content-type": "text/html;charset=UTF-8" } });
	},
};
