// Slot coordinates for each supported formation, as percentages of the
// pitch (0,0 = bottom-left, 100,100 = top-right). The pitch SVG draws
// our half at the bottom — y=92 is the GK line, y=8 is the opposition
// half. Slot ids must be unique within a formation; the same id (e.g.
// 'ST') is used in the lineup jsonb so changing a formation re-keys.
//
// Why hard-coded coords: kids' formations don't change often; a static
// table is simpler than a layout engine and reads like a tactics board.

export const FORMATIONS = {
    '4-4-2': {
        label: '4-4-2',
        slots: [
            { id: 'GK',  x: 50, y: 92 },
            { id: 'LB',  x: 15, y: 72 },
            { id: 'LCB', x: 38, y: 76 },
            { id: 'RCB', x: 62, y: 76 },
            { id: 'RB',  x: 85, y: 72 },
            { id: 'LM',  x: 15, y: 50 },
            { id: 'LCM', x: 38, y: 52 },
            { id: 'RCM', x: 62, y: 52 },
            { id: 'RM',  x: 85, y: 50 },
            { id: 'ST',  x: 38, y: 25 },
            { id: 'ST2', x: 62, y: 25 },
        ],
    },
    '4-3-3': {
        label: '4-3-3',
        slots: [
            { id: 'GK',  x: 50, y: 92 },
            { id: 'LB',  x: 15, y: 72 },
            { id: 'LCB', x: 38, y: 76 },
            { id: 'RCB', x: 62, y: 76 },
            { id: 'RB',  x: 85, y: 72 },
            { id: 'CDM', x: 50, y: 58 },
            { id: 'LCM', x: 30, y: 45 },
            { id: 'RCM', x: 70, y: 45 },
            { id: 'LW',  x: 18, y: 22 },
            { id: 'ST',  x: 50, y: 18 },
            { id: 'RW',  x: 82, y: 22 },
        ],
    },
    '4-2-3-1': {
        label: '4-2-3-1',
        slots: [
            { id: 'GK',  x: 50, y: 92 },
            { id: 'LB',  x: 15, y: 72 },
            { id: 'LCB', x: 38, y: 76 },
            { id: 'RCB', x: 62, y: 76 },
            { id: 'RB',  x: 85, y: 72 },
            { id: 'LDM', x: 38, y: 58 },
            { id: 'RDM', x: 62, y: 58 },
            { id: 'LAM', x: 22, y: 38 },
            { id: 'CAM', x: 50, y: 38 },
            { id: 'RAM', x: 78, y: 38 },
            { id: 'ST',  x: 50, y: 18 },
        ],
    },
    '3-5-2': {
        label: '3-5-2',
        slots: [
            { id: 'GK',  x: 50, y: 92 },
            { id: 'LCB', x: 25, y: 76 },
            { id: 'CB',  x: 50, y: 78 },
            { id: 'RCB', x: 75, y: 76 },
            { id: 'LWB', x: 12, y: 55 },
            { id: 'LCM', x: 35, y: 50 },
            { id: 'CM',  x: 50, y: 55 },
            { id: 'RCM', x: 65, y: 50 },
            { id: 'RWB', x: 88, y: 55 },
            { id: 'ST',  x: 38, y: 22 },
            { id: 'ST2', x: 62, y: 22 },
        ],
    },
    '3-4-3': {
        label: '3-4-3',
        slots: [
            { id: 'GK',  x: 50, y: 92 },
            { id: 'LCB', x: 25, y: 76 },
            { id: 'CB',  x: 50, y: 78 },
            { id: 'RCB', x: 75, y: 76 },
            { id: 'LM',  x: 15, y: 52 },
            { id: 'LCM', x: 38, y: 52 },
            { id: 'RCM', x: 62, y: 52 },
            { id: 'RM',  x: 85, y: 52 },
            { id: 'LW',  x: 18, y: 22 },
            { id: 'ST',  x: 50, y: 18 },
            { id: 'RW',  x: 82, y: 22 },
        ],
    },
    '3-4-1-2': {
        label: '3-4-1-2',
        slots: [
            { id: 'GK',  x: 50, y: 92 },
            { id: 'LCB', x: 25, y: 76 },
            { id: 'CB',  x: 50, y: 78 },
            { id: 'RCB', x: 75, y: 76 },
            { id: 'LM',  x: 15, y: 52 },
            { id: 'LCM', x: 38, y: 52 },
            { id: 'RCM', x: 62, y: 52 },
            { id: 'RM',  x: 85, y: 52 },
            { id: 'CAM', x: 50, y: 32 },
            { id: 'ST',  x: 38, y: 16 },
            { id: 'ST2', x: 62, y: 16 },
        ],
    },
    '3-3-3-1': {
        label: '3-3-3-1',
        slots: [
            { id: 'GK',  x: 50, y: 92 },
            { id: 'LCB', x: 25, y: 76 },
            { id: 'CB',  x: 50, y: 78 },
            { id: 'RCB', x: 75, y: 76 },
            { id: 'LDM', x: 30, y: 60 },
            { id: 'CDM', x: 50, y: 60 },
            { id: 'RDM', x: 70, y: 60 },
            { id: 'LAM', x: 22, y: 36 },
            { id: 'CAM', x: 50, y: 36 },
            { id: 'RAM', x: 78, y: 36 },
            { id: 'ST',  x: 50, y: 14 },
        ],
    },
    '3-1-4-2': {
        label: '3-1-4-2',
        slots: [
            { id: 'GK',  x: 50, y: 92 },
            { id: 'LCB', x: 25, y: 76 },
            { id: 'CB',  x: 50, y: 78 },
            { id: 'RCB', x: 75, y: 76 },
            { id: 'CDM', x: 50, y: 64 },
            { id: 'LM',  x: 15, y: 46 },
            { id: 'LCM', x: 38, y: 48 },
            { id: 'RCM', x: 62, y: 48 },
            { id: 'RM',  x: 85, y: 46 },
            { id: 'ST',  x: 38, y: 18 },
            { id: 'ST2', x: 62, y: 18 },
        ],
    },
};

export const FORMATION_IDS = Object.keys(FORMATIONS);

// Friendly label per slot id, used in tooltips + per-row drilldowns.
// Kept generic — coaches who care about specific tactics can rename in
// their head; the slot id is the source of truth.
export const SLOT_LABELS = {
    GK: 'Goalkeeper',
    LB: 'Left Back', RB: 'Right Back',
    LCB: 'Left Center Back', RCB: 'Right Center Back', CB: 'Center Back',
    LWB: 'Left Wing Back', RWB: 'Right Wing Back',
    CDM: 'Defensive Mid', LDM: 'Left Def. Mid', RDM: 'Right Def. Mid',
    LCM: 'Left Center Mid', RCM: 'Right Center Mid', CM: 'Center Mid',
    LM: 'Left Mid', RM: 'Right Mid',
    LAM: 'Left Att. Mid', CAM: 'Attacking Mid', RAM: 'Right Att. Mid',
    LW: 'Left Wing', RW: 'Right Wing',
    ST: 'Striker', ST2: 'Striker',
};
