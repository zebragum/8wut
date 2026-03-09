export type User = {
  id: string;
  username: string;
  avatarUrl: string;
  isFollowing: boolean;
  groups?: string[];
};

export type Comment = {
  id: string;
  username: string;
  text: string;
  timestamp: string;
};

export type MOCK_COLOR_PRESET = 'transparent' | 'skyblue' | 'lavender' | 'orange' | 'grass' | 'yellow' | 'red';

export type Post = {
  id: string;
  author: User;
  images?: string[];         // Optional if text-only
  textBackground?: MOCK_COLOR_PRESET; // Used if 'images' is empty
  caption: string;           
  likes: number;
  hasLiked: boolean;
  savedToFridge?: boolean;
  comments: Comment[];
  timestamp: string;
};

export const MOCK_USERS: User[] = [
  { id: '1', username: 'Zach', avatarUrl: '/avatar_zach.jpg', isFollowing: true, groups: ['cooking aficionados', 'organic foods', 'personal trainers', 'gluten free (mostly)', 'bikers/cyclists', 'food journalers', 'primal', 'bodybuilders & fitness competitors'] },
  { id: '2', username: 'chef.steve', avatarUrl: 'https://i.pravatar.cc/150?img=11', isFollowing: false },
  { id: '3', username: 'late_night_bites', avatarUrl: 'https://i.pravatar.cc/150?img=32', isFollowing: true },
];

export const MOCK_FEED: Post[] = [
  {
    id: 'p1',
    author: MOCK_USERS[0],
    images: [
      'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&q=80',
      'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800&q=80'
    ],
    caption: 'Best avocado toast in the city! 🥑✨ The sourdough was perfectly crispy.',
    likes: 124,
    hasLiked: false,
    comments: [
      { id: 'c1', username: 'chef.steve', text: 'Looks amazing!', timestamp: '2h' },
      { id: 'c1b', username: 'foodie_gal', text: 'Where did you get this?', timestamp: '1h' }
    ],
    timestamp: '3h ago'
  },
  {
    id: 'p2',
    author: MOCK_USERS[1],
    images: [
      'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=800&q=80',
      'https://images.unsplash.com/photo-1482049016688-2d3e1b311543?w=800&q=80',
      'https://images.unsplash.com/photo-1460306855393-0410f61241c7?w=800&q=80'
    ],
    caption: 'My latest test kitchen creation. What do we think? 🍔🔥',
    likes: 3892,
    hasLiked: true,
    comments: [
      { id: 'c2', username: 'foodie_gal', text: 'I need the recipe NOW!', timestamp: '1h' },
      { id: 'c3', username: 'late_night_bites', text: 'That glaze though...', timestamp: '30m' }
    ],
    timestamp: '5h ago'
  },
  {
    id: 'p3',
    author: MOCK_USERS[2],
    textBackground: 'orange',
    caption: 'Anyone else craving spicy ramen at 2am, or is it just me? 🍜🔥',
    likes: 852,
    hasLiked: false,
    comments: [],
    timestamp: '1h ago'
  },
  {
    id: 'p4',
    author: MOCK_USERS[0],
    images: [
      'https://images.unsplash.com/photo-1528825871115-3581a5387919?w=800&q=80',
      'https://images.unsplash.com/photo-1543339308-43e59d6b73a6?w=800&q=80',
      'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&q=80',
      'https://images.unsplash.com/photo-1476224203421-9ac39bcb3327?w=800&q=80',
      'https://images.unsplash.com/photo-1498654896293-37aacf113fd9?w=800&q=80'
    ],
    caption: 'Tasting menu was out of this world! 🍷✨',
    likes: 541,
    hasLiked: true,
    comments: [],
    timestamp: 'Yesterday'
  }
];

export const MOCK_NOTIFICATIONS = [
  { 
    id: 'n1', 
    type: 'fridge', 
    user: { id: '4', username: 'Heather', avatarUrl: 'https://i.pravatar.cc/150?img=5', isFollowing: false }, 
    postImage: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=200&q=80', 
    text: 'added your post to her Fridge',
    timestamp: '10m ago' 
  },
  { 
    id: 'n2', 
    type: 'follow', 
    user: { id: '5', username: 'Pearl', avatarUrl: 'https://i.pravatar.cc/150?img=9', isFollowing: false }, 
    text: 'followed you',
    timestamp: '1h ago' 
  }
];
