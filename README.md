# JECS Quick Wash Admin Dashboard

A modern admin dashboard for JECS Quick Wash built with React and Vite.

## Getting Started

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone https://github.com/AndreDaGOAT/JECS-Quick-Wash-Admin-Dashboard.git
cd JECS-Quick-Wash-Admin-Dashboard
```

2. Install dependencies:
```bash
npm install
```

3. Create environment variables:
```bash
cp .env.example .env
```

### Development

Start the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:5173`

### Build

Build for production:
```bash
npm run build
```

### Preview

Preview the production build:
```bash
npm run preview
```

## Project Structure

```
jecs-admin-dashboard/
├── package.json
├── vite.config.js
├── index.html
├── .gitignore
├── .env.example
├── README.md
├── src/
│   ├── main.jsx
│   ├── App.jsx
│   ├── dashboard/
│   │   └── jecs-admin-dashboard.jsx
│   └── index.css
└── public/
    └── favicon.ico
```

## Technologies

- **React 18** - UI library
- **Vite** - Build tool and dev server
- **JavaScript (ES6+)** - Programming language

## Features

- ✨ Modern dashboard interface
- 📊 Real-time statistics display
- 📱 Responsive design
- ⚡ Fast development with Vite HMR
- 🎨 Beautiful UI with CSS styling

## Environment Variables

See `.env.example` for available environment variables.

## License

MIT
