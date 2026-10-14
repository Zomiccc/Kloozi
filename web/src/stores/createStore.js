import { create } from 'zustand';

/* One consistent creation trigger lives in the top command bar.
   Each page registers its contextual action(s) on mount;
   the bar renders them as a small popover. No page-level
   duplicate CTA buttons anywhere. */
const useCreateRegistry = create((set) => ({
  actions: [],
  register: (entries) => set({ actions: entries || [] }),
  clear: () => set({ actions: [] }),
}));

export default useCreateRegistry;
