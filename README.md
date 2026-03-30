# 🚀 LocalNotes

<p align="center">
  <img src="https://i.imgur.com/a9QWW0v.png" alt="LocalNotes Logo" width="200">
</p>

**LocalNotes** is a professional-grade, privacy-first, local-only note-taking application powered by local AI. Built with Electron and Next.js, it offers a seamless blend of traditional rich-text/Markdown editing and cutting-edge Retrieval-Augmented Generation (RAG) capabilities—all without your data ever leaving your machine.

---

## 🤔 What You Can Do with LocalNotes

LocalNotes is more than a text editor; it's a personal knowledge forge. Here are some of the powerful workflows you can achieve:

- **Build a Private Brain**: Index thousands of notes and PDFs. Use the built-in AI to find connections, summarize long documents, or extract specific data—all without an internet connection.
- **Visual Brainstorming**: Use the **Infinite-Growth Canvas** to sketch diagrams, mind maps, or handwritten notes. Strokes are automatically split across pages for a natural notebook feel.
- **Academic Writing**: Write complex research notes with full **LaTeX** math support and multi-language syntax highlighting for your code snippets.
- **AI-Augmented Research**: Chat with your local LLM (via Ollama or node-llama-cpp). Ask, "Based on my class notes from last week, what are the key themes?" and watch the AI retrieve the exact context from your local files.
- **Seamless Organization**: Use the deep tagging system and multi-tab interface to stay focused. Every file change is tracked in real-time, so your external edits are always synchronized.

---

## ✨ Key Features

### 🤖 Intelligent AI Workflows
- **Retrieval-Augmented Generation (RAG)**: Automatically chunks and indexes your local directories into a vector database (`sqlite-vec`) for context-aware AI chat.
- **Thinking Mode**: Toggle "Show Thinking" to see the AI's internal chain of thought as it processes your requests.
- **Voice-to-Text**: Built-in dictation support for hands-free note-taking.
- **Multi-Model Support**: Easily switch between different local LLM models (Llama 3, Mistral, Phi-3, etc.) and customize model capabilities like file uploads and voice interaction.

### 🎨 Versatile Content Creation
- **Multi-Page Canvas**: A dedicated drawing environment with smooth pointer/touch support, auto-growing pages, and zoom/pan orchestration.
- **Dual-Mode Editing**: Choose between **Tiptap** for a seamless WYSIWYG experience or **MDXEditor** for professional Markdown/MDX power.
- **Rich Media**: Embed images, math equations (LaTeX), and syntax-highlighted code blocks with zero configuration.

### 🛠️ Robust Local Infrastructure
- **Real-time File Watcher**: Instantly updates your AI index and file tree when you modify files using external tools.
- **SQLite-Powered Core**: High-performance storage for tags, metadata, and vector embeddings.
- **Extensible Settings**: Fine-tune your AI provider, keybindings, and UI themes (Light/Dark mode).

---

## 🛠️ Tech Stack

- **Framework**: [Nextron](https://github.com/saltyshippo/nextron) (Next.js + Electron)
- **Editor**: [Tiptap](https://tiptap.dev/) & [MDXEditor](https://mdxeditor.dev/)
- **AI Engine**: [node-llama-cpp](https://node-llama-cpp.withcatai.io/) for local LLM execution
- **Database**: [Better-SQLite3](https://github.com/WiseLibs/better-sqlite3) with [sqlite-vec](https://github.com/asg017/sqlite-vec)
- **Styling**: Tailwind CSS & Lucide Icons
- **Animation**: Framer Motion

---

## 📽️ Demo

Watch LocalNotes in action: [View Demo Video](https://drive.google.com/file/d/1kw_hmX8BUm4GTo87SxqD4JejlgJ3CG3O/view?usp=sharing)

---

## 🚀 Getting Started

### Prerequisites

- Node.js (Latest LTS recommended)
- npm, yarn, or pnpm

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/Abdulaziz-Ali123/LocalNotes.git
   cd LocalNotes
   ```

2. Install dependencies:
   ```bash
   # using npm
   npm install
   
   # or using yarn
   yarn install
   
   # or using pnpm
   pnpm install --shamefully-hoist
   ```

3. Post-install (Electron dependencies):
   ```bash
   npm run postinstall
   ```

### Development

Run the application in development mode:
```bash
npm run dev
```

### Production Build

Build the production binaries for your current platform:
```bash
npm run build
```

---

## 📄 Documentation

Detailed software architecture, RAG implementation details, and sprint documentation can be found in the `Documentation` folder.

---

## 🤝 Contributing

Contributions are welcome! If you find a bug or have a feature request, please open an issue.

