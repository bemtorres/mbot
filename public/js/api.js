/**
 * Cliente de API para interactuar con el backend de MBot
 */
const API = {
  // Bots
  async getBots() {
    const res = await fetch('/api/bots');
    return res.json();
  },

  async getBot(id) {
    const res = await fetch(`/api/bots/${id}`);
    return res.json();
  },

  async createBot(data) {
    const res = await fetch('/api/bots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  },

  async updateBot(id, data) {
    const res = await fetch(`/api/bots/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  },

  async deleteBot(id) {
    const res = await fetch(`/api/bots/${id}`, { method: 'DELETE' });
    return res.json();
  },

  // Conversaciones y Chat
  async getConversations(botId) {
    const res = await fetch(`/api/bots/${botId}/conversations`);
    return res.json();
  },

  async getMessages(conversationId) {
    const res = await fetch(`/api/conversations/${conversationId}/messages`);
    return res.json();
  },

  async sendMessage(botId, conversationId, message) {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ botId, conversationId, message })
    });
    return res.json();
  },

  async clearConversation(conversationId) {
    const res = await fetch(`/api/conversations/${conversationId}`, {
      method: 'DELETE'
    });
    return res.json();
  },

  // Base de Conocimiento (RAG)
  async getKnowledgeDocs(botId) {
    const res = await fetch(`/api/bots/${botId}/knowledge`);
    return res.json();
  },

  async addKnowledgeDoc(botId, title, content) {
    const res = await fetch(`/api/bots/${botId}/knowledge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, content })
    });
    return res.json();
  },

  async deleteKnowledgeDoc(docId) {
    const res = await fetch(`/api/knowledge/${docId}`, {
      method: 'DELETE'
    });
    return res.json();
  },

  async testSemanticSearch(botId, query) {
    const res = await fetch(`/api/bots/${botId}/knowledge/test-search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query })
    });
    return res.json();
  },

  // Configuración de API Keys
  async getSettings() {
    const res = await fetch('/api/settings');
    return res.json();
  },

  async saveSettings(data) {
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  }
};

window.API = API;
