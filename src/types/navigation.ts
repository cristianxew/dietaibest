/**
 * Navigation item interface for main navigation links
 */
export interface NavigationItem {
  /**
   * Unique identifier for the navigation item
   */
  id: string;
  /**
   * Display label for the navigation item (translation key)
   */
  label: string;
  /**
   * URL path for the navigation item
   */
  href: string;
  /**
   * Optional icon component name for the navigation item
   */
  icon?: string;
  /**
   * Whether the navigation item requires authentication
   */
  requiresAuth?: boolean;
  /**
   * Optional badge content for the navigation item
   */
  badge?: string | number;
  /**
   * Whether the navigation item is disabled
   */
  disabled?: boolean;
  /**
   * Optional submenu items for dropdown navigation
   */
  children?: NavigationItem[];
  /**
   * Optional external link indicator
   */
  external?: boolean;
  /**
   * Optional keyboard shortcut for the navigation item
   */
  shortcut?: string;
}

/**
 * User dropdown menu item interface
 */
export interface UserMenuItem {
  /**
   * Unique identifier for the menu item
   */
  id: string;
  /**
   * Display label for the menu item (translation key)
   */
  label: string;
  /**
   * URL path or action for the menu item
   */
  href?: string;
  /**
   * Optional click handler for the menu item
   */
  onClick?: () => void;
  /**
   * Optional icon component name for the menu item
   */
  icon?: string;
  /**
   * Whether the menu item is a separator
   */
  separator?: boolean;
  /**
   * Whether the menu item is dangerous (destructive action)
   */
  variant?: "default" | "destructive";
}

/**
 * Mobile menu section interface
 */
export interface MobileMenuSection {
  /**
   * Unique identifier for the section
   */
  id: string;
  /**
   * Optional section title (translation key)
   */
  title?: string;
  /**
   * Navigation items in this section
   */
  items: NavigationItem[];
  /**
   * Whether the section should have a separator
   */
  separator?: boolean;
}

/**
 * Authentication state interface for navigation
 */
export interface NavigationAuthState {
  /**
   * Whether the user is authenticated
   */
  isAuthenticated: boolean;
  /**
   * Whether authentication is loading
   */
  isLoading: boolean;
  /**
   * User information for authenticated users
   */
  user?: {
    id: string;
    email?: string;
    name?: string;
    image?: string;
  } | null;
}

/**
 * Navigation configuration interface
 */
export interface NavigationConfig {
  /**
   * Main navigation items
   */
  mainNavigation: NavigationItem[];
  /**
   * User dropdown menu items
   */
  userMenuItems: UserMenuItem[];
  /**
   * Mobile menu sections
   */
  mobileMenuSections: MobileMenuSection[];
}

/**
 * Navigation component props base interface
 */
export interface NavigationBaseProps {
  /**
   * Optional CSS class name for styling customization
   */
  className?: string;
  /**
   * Current route path for active state detection
   */
  currentPath?: string;
}
