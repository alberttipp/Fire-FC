# 🔥 Fire FC - Youth Soccer Club Management

A modern web app for youth soccer clubs to manage teams, players, training, and communication — with gamification features to keep kids engaged.

## Features

### For Coaches & Managers
- **Club Overview** - See all teams at a glance
- **Team Management** - Roster, player cards, evaluations
- **Training Hub** - Assign drills, track completion
- **Calendar** - Schedule practices, games, events with RSVP tracking
- **Chat** - Team & parent communication
- **Tryout Management** - (Manager only) Scout cards, evaluations

### For Parents
- **Family Dashboard** - See all your children's activities
- **Event RSVPs** - Respond to games and practices
- **Training Progress** - Track homework completion

### For Players
- **Player Card** - FIFA-style stats card
- **Homework Hub** - Complete assigned drills
- **Badge System** - Earn trophies for achievements
- **Leaderboard** - Compete with teammates
- **Mini Game** - Futsal arena (coming soon: Head Ball!)

## Tech Stack

- **Frontend:** React 19 + Vite
- **Styling:** Tailwind CSS
- **Backend:** Supabase (Auth, Database, RLS)
- **Animations:** Framer Motion
- **Icons:** Lucide React

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn
- Supabase account

### Installation

```bash
# Clone the repo
git clone https://github.com/yourusername/fire-fc.git
cd fire-fc

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your Supabase credentials

# Run development server
npm run dev
```

### Environment Variables

Create a `.env` file in the root:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
```

> ⚠️ **Never commit your `.env` file or expose your service role key!**

### Database Setup

1. Create a new Supabase project
2. Run the SQL files in `/supabase` folder in order:
   - `schema.sql` - Core tables
   - `setup_events.sql` - Events & RSVPs
   - `setup_family.sql` - Family relationships
   - `setup_invites.sql` - Team invite codes
   - `handle_new_user.sql` - Auth triggers

## Project Structure

```
src/
├── components/
│   ├── dashboard/     # Coach/Manager views
│   ├── player/        # Player-specific components
│   └── game/          # Mini-game components
├── context/           # React Context (Auth)
├── data/              # Static data (badges, drills)
├── pages/             # Route pages
└── utils/             # Helper functions
```

## Scripts

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run preview  # Preview production build
npm run lint     # Run ESLint
```

## Roadmap

- [ ] Head Ball mini-game
- [ ] Push notifications
- [ ] Offline support
- [ ] Multi-club support
- [ ] Payment integration

## License

Private - All rights reserved.

---

Built with ⚽ for youth soccer
