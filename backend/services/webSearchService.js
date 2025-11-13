import { config } from '../config/index.js';

// Use global fetch (Node.js 18+) - should be available
const fetchFn = typeof fetch !== 'undefined' ? fetch : globalThis.fetch;

/**
 * Perform web search using Ollama's web search API
 * Optionally prefer a domain (e.g., geeksforgeeks.org)
 */
export async function webSearch(query, maxResults = 5, preferDomain = '') {
  try {
    if (!config.ollamaApiKey) {
      console.warn('OLLAMA_API_KEY not set - web search will be limited');
      return [];
    }
    // Use Ollama's web search API
    const response = await fetchFn('https://ollama.com/api/web_search', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.ollamaApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        max_results: Math.min(maxResults, 10),
      }),
    });
    if (!response.ok) {
      throw new Error(`Web search failed: ${response.statusText}`);
    }
    const data = await response.json();
    let results = data.results || [];
    if (preferDomain) {
      const preferred = results.filter(r => r.url && r.url.includes(preferDomain));
      const rest = results.filter(r => !r.url || !r.url.includes(preferDomain));
      results = [...preferred, ...rest];
    }
    return results;
  } catch (error) {
    console.error('Web search error:', error);
    return [];
  }
}

/**
 * Fetch web page content using Ollama's web fetch API
 * @param {string} url - URL to fetch
 * @returns {Promise<Object>} Page content with title, content, and links
 */
export async function webFetch(url) {
  try {
    if (!config.ollamaApiKey) {
      console.warn('OLLAMA_API_KEY not set - web fetch will be limited');
      return { title: '', content: '', links: [] };
    }

    const response = await fetchFn('https://ollama.com/api/web_fetch', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.ollamaApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url }),
    });

    if (!response.ok) {
      throw new Error(`Web fetch failed: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Web fetch error:', error);
    return { title: '', content: '', links: [] };
  }
}

/**
 * Generate learning module content using web search
 * Prefer geeksforgeeks for technical content if asked
 */
export async function generateLearningModule(topic, preferGeeks = false) {
  try {
    // Prefer geeksforgeeks.org for content
    const searchResults = await webSearch(topic, 8, preferGeeks ? 'geeksforgeeks.org' : '');
    // Custom dedupe: keep all gfg up top, then one per other domain
    const seen = new Set(), usedDomains = new Set(), out = [];
    for (const r of searchResults) {
      if (!r.title || !r.url) continue;
      const key = (r.url) + '::' + r.title;
      const domain = r.url.match(/^https?:\/\/(?:www\.)?([^\/]+)/)?.[1] || '';
      if (seen.has(key)) continue;
      if (domain === 'geeksforgeeks.org') {
        out.push(r); seen.add(key);
      }
    }
    // Add one result per non-gfg domain
    for (const r of searchResults) {
      if (!r.title || !r.url) continue;
      const domain = r.url.match(/^https?:\/\/(?:www\.)?([^\/]+)/)?.[1] || '';
      if (domain === 'geeksforgeeks.org') continue;
      if (usedDomains.has(domain)) continue;
      out.push(r); usedDomains.add(domain);
    }
    const uniqResults = out.slice(0, 5);
    if (uniqResults.length === 0) {
      return {
        topic,
        content: `# ${topic}\n\nNo high-quality resources found. Try another topic or rephrase.`,
        resources: [],
      };
    }
    const summary = uniqResults.map(r => `### [${r.title}](${r.url})\n${r.content?.slice(0,300)||""}...`).join("\n\n");
    return {
      topic,
      content: `# ${topic} — GeeksforGeeks and Curated Learning Module\n\n${summary}`,
      resources: uniqResults.map(r=>({ title: r.title, url: r.url })),
      searchResults: uniqResults,
    };
  } catch (error) {
    console.error('Learning module generation error:', error);
    return {
      topic,
      content: `# ${topic}\n\nError generating learning module. Please try again later.`,
      resources: [],
    };
  }
}

export default { webSearch, webFetch, generateLearningModule };

