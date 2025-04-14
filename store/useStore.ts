import { create } from 'zustand';

interface WatchlistItem {
  id: number;
  name: string;
  currentPrice: number;
}

interface Store {
  watchlist: WatchlistItem[];
  addToWatchlist: (item: WatchlistItem) => void;
  removeFromWatchlist: (id: number) => void;
}

export const useStore = create<Store>((set) => ({
  watchlist: [],
  addToWatchlist: (item) =>
    set((state) => ({
      watchlist: [...state.watchlist, item],
    })),
  removeFromWatchlist: (id) =>
    set((state) => ({
      watchlist: state.watchlist.filter((item) => item.id !== id),
    })),
}));