# Hoosat Explorer

A modern, performant blockchain explorer for the Hoosat Network built with React.

**Live Version:** [https://network.hoosat.fi](https://network.hoosat.fi)

## Features

- **Real-time Block Explorer** - View the latest blocks and transactions as they happen
- **Address Lookup** - Search and track addresses, balances, and transaction history
- **Transaction Details** - Comprehensive transaction information with inputs and outputs
- **Network Statistics** - Live network metrics including hashrate, difficulty, and block count
- **Responsive Design** - Optimized for both desktop and mobile devices
- **Performance Optimized** - Built with React best practices for fast rendering and smooth UX

## Technology Stack

- **React** - UI framework
- **React Router** - Client-side routing
- **Bootstrap** - Responsive grid and components
- **SCSS** - Styling with variables and mixins
- **Moment.js** - Date formatting
- **Framer Motion** - Smooth animations
- **React Tooltip** - Interactive tooltips

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn

## Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/hoosat-explorer.git

# Navigate to the explorer directory
cd Hoosat/explorer

# Install dependencies
npm install
```

## Development

```bash
# Start development server
npm start
```

The app will open at [http://localhost:3000](http://localhost:3000)

## Build

```bash
# Create production build
npm run build
```

The optimized build will be in the `build/` directory.

## Environment Variables

Create a `.env` file in the root directory:

```
REACT_APP_API=https://api.hoosat.fi
```

The dashboard's block reward and daily yield take the 5 % dev fee off the
reward from DAA score 17,500,000 until the v12 hard fork at DAA score
258,000,000. A build for another network or a moved fork can set
`REACT_APP_DEV_FEE_END_DAA_SCORE` (a positive integer) to change the end.

## Project Structure

```
explorer/
├── public/           # Static assets
├── src/
│   ├── components/   # React components
│   ├── htn-api-client.js  # API client
│   ├── App.js        # Main app component
│   └── App.scss      # Global styles
└── package.json
```

## API Integration

This explorer connects to the Hoosat API to fetch blockchain data. The API base URL is configured via the `REACT_APP_API` environment variable.

## Performance Optimizations

- React.memo for component memoization
- useMemo and useCallback hooks for expensive computations
- Optimized mobile rendering with disabled backdrop-blur
- Efficient WebSocket handling for real-time updates

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).
