import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HiMenu, HiX, HiChevronDown, HiSearch } from 'react-icons/hi';
import { FaChrome, FaGlobe, FaAndroid, FaApple, FaDesktop, FaWallet } from 'react-icons/fa';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { getBlock } from '../htn-api-client';

const Header = ({ price, isConnected }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [walletsOpen, setWalletsOpen] = useState(false);
  const [mobileWalletsOpen, setMobileWalletsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const walletsDropdownRef = useRef(null);
  const navigate = useNavigate();

  const walletOptions = [
    {
      name: 'Web Wallet',
      href: '/',
      icon: FaGlobe,
      description: 'Access via browser'
    },
    {
      name: 'Chrome Extension',
      href: 'https://chromewebstore.google.com/detail/djcpncochmpbipoiblkafkjfbfolnkom',
      icon: FaChrome,
      description: 'Browser extension'
    },
    {
      name: 'Desktop Wallet',
      href: '/',
      icon: FaDesktop,
      description: 'Windows, macOS, Linux'
    },
    {
      name: 'Android Wallet',
      href: 'https://play.google.com/store/apps/details?id=fi.hoosat_mobile.hoosatwallet',
      icon: FaAndroid,
      description: 'Google Play Store'
    },
    {
      name: 'iOS Wallet',
      href: 'https://apps.apple.com/us/app/hoosat-mobile/id6739613804',
      icon: FaApple,
      description: 'Apple App Store'
    },
    {
      name: 'Ledger Vault',
      href: '/',
      icon: FaWallet,
      description: 'Hardware wallet support'
    },
  ];

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (walletsDropdownRef.current && !walletsDropdownRef.current.contains(event.target)) {
        setWalletsOpen(false);
      }
    };

    if (walletsOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [walletsOpen]);

  // Prevent body scroll when mobile menu is open or search modal is open
  useEffect(() => {
    if (isOpen || searchOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, searchOpen]);

  const handleSearch = async (e) => {
    e.preventDefault();
    const v = searchValue.trim();

    if (v.length === 64) {
      try {
        const data = await getBlock(v);
        if (data.detail === "Block not found") {
          navigate(`/txs/${v}`);
        } else {
          navigate(`/blocks/${v}`);
        }
      } catch (err) {
        // Error handling
      }
    } else if (v.startsWith("hoosat:")) {
      navigate(`/addresses/${v}`);
    }

    setSearchValue('');
    setSearchOpen(false);
  };

  return (
    <>
    <motion.header
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.5 }}
      className="sticky top-0 left-0 right-0 z-50 bg-hoosat-dark/80 backdrop-blur-lg"
      style={{ borderBottom: '1px solid #1e293b' }}
    >
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex-shrink-0">
            <Link to="/" className="flex items-center gap-3 group no-underline">
              <img
                src="/k-icon-glow.png"
                alt="Hoosat Explorer Logo"
                className="h-10 w-10 transition-transform duration-300 group-hover:scale-110"
              />
              <span className="text-2xl font-bold text-gradient">
                Hoosat Explorer
              </span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden xl:flex items-center space-x-8">
            <a
              href="/"
              className="text-slate-300 hover:text-hoosat-teal transition-colors duration-200 no-underline"
            >
              Home
            </a>
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `transition-colors duration-200 no-underline ${
                  isActive
                    ? 'text-hoosat-teal'
                    : 'text-slate-300 hover:text-hoosat-teal'
                }`
              }
            >
              Dashboard
            </NavLink>
            <NavLink
              to="/blocks"
              className={({ isActive }) =>
                `transition-colors duration-200 no-underline ${
                  isActive
                    ? 'text-hoosat-teal'
                    : 'text-slate-300 hover:text-hoosat-teal'
                }`
              }
            >
              Blocks
            </NavLink>
            <NavLink
              to="/txs"
              className={({ isActive }) =>
                `transition-colors duration-200 no-underline ${
                  isActive
                    ? 'text-hoosat-teal'
                    : 'text-slate-300 hover:text-hoosat-teal'
                }`
              }
            >
              Transactions
            </NavLink>
            <NavLink
              to="/addresses"
              className={({ isActive }) =>
                `transition-colors duration-200 no-underline ${
                  isActive
                    ? 'text-hoosat-teal'
                    : 'text-slate-300 hover:text-hoosat-teal'
                }`
              }
            >
              Addresses
            </NavLink>

            {/* Wallets Dropdown */}
            <div className="relative" ref={walletsDropdownRef}>
              <button
                onClick={() => setWalletsOpen(!walletsOpen)}
                className="flex items-center gap-1 text-slate-300 hover:text-hoosat-teal transition-colors duration-200 cursor-pointer bg-transparent border-0 p-0"
                style={{ textDecoration: 'none' }}
              >
                Wallets
                <HiChevronDown className={`transition-transform duration-200 ${walletsOpen ? 'rotate-180' : ''}`} />
              </button>

              <AnimatePresence>
                {walletsOpen && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.1 }}
                    className="absolute top-full left-0 mt-2 w-64 bg-hoosat-slate/95 backdrop-blur-lg border border-slate-700 rounded-lg shadow-xl overflow-hidden"
                  >
                    {walletOptions.map((wallet) => (
                      <a
                        key={wallet.name}
                        href={wallet.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 px-4 py-3 hover:bg-hoosat-teal/10 transition-colors duration-200 border-b border-slate-700 last:border-b-0 no-underline"
                        style={{ textDecoration: 'none' }}
                      >
                        <wallet.icon className="text-xl text-hoosat-teal flex-shrink-0" />
                        <div className="text-left">
                          <div className="text-slate-200 font-semibold text-sm">{wallet.name}</div>
                          <div className="text-slate-400 text-xs">{wallet.description}</div>
                        </div>
                      </a>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Search Icon */}
            <button
              onClick={() => setSearchOpen(true)}
              className="text-slate-300 hover:text-hoosat-teal transition-colors duration-200 bg-transparent border-0 p-0"
              style={{ textDecoration: 'none' }}
            >
              <HiSearch size={24} />
            </button>

            {/* Price Badge */}
            <div className="flex items-center px-4 py-2 bg-hoosat-teal/10 rounded-lg border border-slate-700">
              <span className="text-hoosat-teal font-semibold">${price}</span>
              <span className="text-slate-400 ml-1 text-sm">/ HTN</span>
            </div>
          </div>

          {/* Mobile Menu Buttons */}
          <div className="xl:hidden flex items-center gap-4">
            {/* Search Icon */}
            <button
              onClick={() => setSearchOpen(true)}
              className="text-slate-300 hover:text-hoosat-teal bg-transparent border-0 p-0"
              style={{ background: 'transparent', border: 'none', outline: 'none' }}
            >
              <HiSearch size={24} />
            </button>

            {/* Menu Button */}
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="text-slate-300 hover:text-hoosat-teal bg-transparent border-0 p-0"
              style={{ background: 'transparent', border: 'none', outline: 'none' }}
            >
              {isOpen ? <HiX size={28} /> : <HiMenu size={28} />}
            </button>
          </div>
        </div>
      </nav>
    </motion.header>

    {/* Mobile Navigation Sidebar */}
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] xl:hidden"
            onClick={() => setIsOpen(false)}
          />

          {/* Sidebar */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'tween', duration: 0.3 }}
            className="fixed top-0 right-0 h-full w-80 max-w-[85vw] bg-hoosat-dark/95 backdrop-blur-lg border-l border-slate-700 shadow-2xl z-[70] xl:hidden overflow-hidden flex flex-col"
          >
            {/* Sidebar Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-700">
              <span className="text-xl font-bold text-gradient">Menu</span>
              <button
                onClick={() => setIsOpen(false)}
                className="text-slate-300 hover:text-hoosat-teal transition-colors duration-200 bg-transparent border-0 p-0"
                style={{ background: 'transparent', border: 'none', outline: 'none', padding: 0 }}
              >
                <HiX size={28} />
              </button>
            </div>

            {/* Scrollable Menu */}
            <div
              className="flex-1 overflow-y-auto overscroll-contain p-4 custom-scrollbar"
              style={{
                scrollbarWidth: 'thin',
                scrollbarColor: '#14B8A6 #1E293B',
              }}
            >
              <nav className="flex flex-col space-y-2">
                {/* Price Display - Mobile */}
                <div className="mb-4 p-3 bg-hoosat-teal/10 rounded-lg border border-slate-700">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 text-sm">Price</span>
                    <div className="flex items-center">
                      <span className="text-hoosat-teal font-semibold">${price}</span>
                      <span className="text-slate-400 ml-1 text-sm">/ HTN</span>
                    </div>
                  </div>
                </div>

                <a
                  href="/"
                  className="py-2 text-slate-300 hover:text-hoosat-teal transition-colors duration-200 no-underline block text-left"
                  onClick={() => setIsOpen(false)}
                  style={{ textDecoration: 'none' }}
                >
                  Home
                </a>
                <NavLink
                  to="/"
                  end
                  className={({ isActive }) =>
                    `py-2 transition-colors duration-200 no-underline block text-left ${
                      isActive
                        ? 'text-hoosat-teal'
                        : 'text-slate-300 hover:text-hoosat-teal'
                    }`
                  }
                  onClick={() => setIsOpen(false)}
                  style={{ textDecoration: 'none' }}
                >
                  Dashboard
                </NavLink>
                <NavLink
                  to="/blocks"
                  className={({ isActive }) =>
                    `py-2 transition-colors duration-200 no-underline block text-left ${
                      isActive
                        ? 'text-hoosat-teal'
                        : 'text-slate-300 hover:text-hoosat-teal'
                    }`
                  }
                  onClick={() => setIsOpen(false)}
                  style={{ textDecoration: 'none' }}
                >
                  Blocks
                </NavLink>
                <NavLink
                  to="/txs"
                  className={({ isActive }) =>
                    `py-2 transition-colors duration-200 no-underline block text-left ${
                      isActive
                        ? 'text-hoosat-teal'
                        : 'text-slate-300 hover:text-hoosat-teal'
                    }`
                  }
                  onClick={() => setIsOpen(false)}
                  style={{ textDecoration: 'none' }}
                >
                  Transactions
                </NavLink>
                <NavLink
                  to="/addresses"
                  className={({ isActive }) =>
                    `py-2 transition-colors duration-200 no-underline block text-left ${
                      isActive
                        ? 'text-hoosat-teal'
                        : 'text-slate-300 hover:text-hoosat-teal'
                    }`
                  }
                  onClick={() => setIsOpen(false)}
                  style={{ textDecoration: 'none' }}
                >
                  Addresses
                </NavLink>

                {/* Mobile Wallets Dropdown */}
                <div className="mb-2">
                  <button
                    onClick={() => setMobileWalletsOpen(!mobileWalletsOpen)}
                    className="flex items-center justify-between w-full py-2 text-slate-300 hover:text-hoosat-teal transition-colors duration-200 bg-transparent border-0 p-0"
                    style={{ background: 'transparent', border: 'none', outline: 'none', padding: '0.5rem 0', textAlign: 'left' }}
                  >
                    Wallets
                    <HiChevronDown className={`transition-transform duration-200 ${mobileWalletsOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {mobileWalletsOpen && (
                    <div className="pl-4 mt-2 space-y-2">
                      {walletOptions.map((wallet) => (
                        <a
                          key={wallet.name}
                          href={wallet.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 py-2 text-slate-400 hover:text-hoosat-teal transition-colors duration-200 no-underline text-left"
                          onClick={() => setIsOpen(false)}
                          style={{ textDecoration: 'none' }}
                        >
                          <wallet.icon className="text-lg flex-shrink-0" />
                          <span className="text-sm text-left">{wallet.name}</span>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </nav>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>

    {/* Search Modal */}
    <AnimatePresence>
      {searchOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[80] flex items-center justify-center"
            onClick={() => setSearchOpen(false)}
          >
            {/* Search Modal Content */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-2xl mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-hoosat-slate/95 backdrop-blur-lg border border-slate-700 rounded-lg shadow-2xl overflow-hidden">
              {/* Modal Header */}
              <div className="flex items-center justify-between p-4 border-b border-slate-700">
                <h3 className="text-xl font-bold text-gradient">Search Blockchain</h3>
                <button
                  onClick={() => setSearchOpen(false)}
                  className="text-slate-300 hover:text-hoosat-teal transition-colors duration-200 bg-transparent border-0 p-0"
                  style={{ background: 'transparent', border: 'none', outline: 'none', padding: 0 }}
                >
                  <HiX size={24} />
                </button>
              </div>

              {/* Info Notice */}
              <div className="p-4 border-b border-slate-700 text-left" style={{
                backgroundColor: 'rgba(20, 184, 166, 0.1)'
              }}>
                <div className="flex items-center gap-3">
                  <i className="fa fa-info-circle" style={{ fontSize: '1.3rem', color: '#14B8A6' }}></i>
                  <div>
                    <p className="mb-0 text-sm" style={{ color: '#e2e8f0' }}>
                      Search for <span style={{ color: '#14B8A6', fontWeight: '600' }}>miner addresses</span>, <span style={{ color: '#14B8A6', fontWeight: '600' }}>block hashes</span>, or <span style={{ color: '#14B8A6', fontWeight: '600' }}>transaction hashes</span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Search Input */}
              <div className="p-6">
                <form onSubmit={handleSearch}>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={searchValue}
                      onChange={(e) => setSearchValue(e.target.value)}
                      placeholder="Enter address, block hash, or transaction hash..."
                      className="flex-1 px-4 py-3 rounded-lg text-slate-200 bg-hoosat-dark border border-slate-600 focus:border-hoosat-teal focus:outline-none focus:ring-2 focus:ring-hoosat-teal/50 transition-all"
                      autoFocus
                    />
                    <button
                      type="submit"
                      className="px-6 py-3 bg-hoosat-teal hover:bg-teal-600 text-white font-semibold rounded-lg transition-all duration-200 hover:shadow-lg hover:shadow-hoosat-teal/50"
                    >
                      <HiSearch size={20} />
                    </button>
                  </div>
                </form>
              </div>
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
    </>
  );
};

export default Header;
