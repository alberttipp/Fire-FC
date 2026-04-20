export const EVENT_TYPE_CONFIG = {
    practice: { border: 'border-green-500', dot: 'bg-green-500', text: 'text-green-400', bg: 'bg-green-500/15', label: 'Practice' },
    game:     { border: 'border-red-500',   dot: 'bg-red-500',   text: 'text-red-400',   bg: 'bg-red-500/15',   label: 'Game' },
    social:   { border: 'border-purple-500',dot: 'bg-purple-500', text: 'text-purple-400',bg: 'bg-purple-500/15', label: 'Social' },
};

export const getEventConfig = (type) => EVENT_TYPE_CONFIG[type] || EVENT_TYPE_CONFIG.practice;

export const RSVP_OPTIONS = {
    going:     { label: 'Going',     color: 'green',  bg: 'bg-green-500',  bgLight: 'bg-green-500/20', text: 'text-green-400' },
    maybe:     { label: 'Maybe',     color: 'yellow', bg: 'bg-yellow-500', bgLight: 'bg-yellow-500/20', text: 'text-yellow-400' },
    not_going: { label: "Can't Go",  color: 'red',    bg: 'bg-red-500',    bgLight: 'bg-red-500/20',    text: 'text-red-400' },
};
