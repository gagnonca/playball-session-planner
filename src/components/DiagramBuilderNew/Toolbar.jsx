import React from 'react';

const TOOL_MODES = {
    SELECT: 'select',
    BALL: 'ball',
    GOAL: 'goal',
    CONE: 'cone',
    ATTACKER: 'attacker',
    DEFENDER: 'defender',
};

const CONE_COLORS = [
    { value: 'orange', label: 'Orange', color: '#FF6B35' },
    { value: 'yellow', label: 'Yellow', color: '#FDD835' },
    { value: 'blue', label: 'Blue', color: '#42A5F5' },
    { value: 'green', label: 'Green', color: '#66BB6A' },
];

export default function Toolbar({ toolMode, setToolMode, selectedConeColor, setSelectedConeColor }) {
    return (
        <div className="w-64 min-w-[16rem] bg-slate-800 border-r border-slate-700 flex flex-col h-full overflow-y-auto">
            <div className="p-4 border-b border-slate-700">
                <h3 className="text-base font-semibold text-slate-300 uppercase tracking-wide">Tools</h3>
            </div>
            <div className="p-4 space-y-6 flex-1">
                <button
                    className={`w-full p-4 rounded-lg text-left flex items-center gap-3 transition-all ${toolMode === TOOL_MODES.SELECT ? 'bg-blue-600 text-white ring-2 ring-blue-400' : 'bg-slate-700 hover:bg-slate-600 text-slate-200'}`}
                    onClick={() => setToolMode(TOOL_MODES.SELECT)}
                >
                    <span>🖱️ Select/Move</span>
                </button>
                <button
                    className={`w-full p-4 rounded-lg text-left flex items-center gap-3 transition-all ${toolMode === TOOL_MODES.BALL ? 'bg-blue-600 text-white ring-2 ring-blue-400' : 'bg-slate-700 hover:bg-slate-600 text-slate-200'}`}
                    onClick={() => setToolMode(TOOL_MODES.BALL)}
                >
                    <span>⚽ Ball</span>
                </button>
                <button
                    className={`w-full p-4 rounded-lg text-left flex items-center gap-3 transition-all ${toolMode === TOOL_MODES.GOAL ? 'bg-blue-600 text-white ring-2 ring-blue-400' : 'bg-slate-700 hover:bg-slate-600 text-slate-200'}`}
                    onClick={() => setToolMode(TOOL_MODES.GOAL)}
                >
                    <span>🥅 Goal</span>
                </button>
                <div className="border-t border-slate-600 pt-6">
                    <h4 className="text-xs font-medium text-slate-400 mb-3 uppercase">Cone</h4>
                    <div className="flex flex-wrap gap-2 mb-3">
                        {CONE_COLORS.map((cone) => (
                            <button
                                key={cone.value}
                                style={{ backgroundColor: cone.color }}
                                className={`w-8 h-8 rounded-full border-2 ${selectedConeColor === cone.color ? 'border-yellow-400' : 'border-slate-400'}`}
                                onClick={() => {
                                    setSelectedConeColor(cone.color);
                                    setToolMode(TOOL_MODES.CONE);
                                }}
                                title={cone.label}
                            />
                        ))}
                    </div>
                </div>
                <button
                    className={`w-full p-4 rounded-lg text-left flex items-center gap-3 transition-all ${toolMode === TOOL_MODES.ATTACKER ? 'bg-blue-600 text-white ring-2 ring-blue-400' : 'bg-slate-700 hover:bg-slate-600 text-slate-200'}`}
                    onClick={() => setToolMode(TOOL_MODES.ATTACKER)}
                >
                    <span style={{ color: '#EF4444', fontWeight: 'bold', fontSize: '1.5rem' }}>●</span>
                    <span>Attacker</span>
                </button>
                <button
                    className={`w-full p-4 rounded-lg text-left flex items-center gap-3 transition-all ${toolMode === TOOL_MODES.DEFENDER ? 'bg-blue-600 text-white ring-2 ring-blue-400' : 'bg-slate-700 hover:bg-slate-600 text-slate-200'}`}
                    onClick={() => setToolMode(TOOL_MODES.DEFENDER)}
                >
                    <span style={{ color: '#3B82F6', fontWeight: 'bold', fontSize: '1.5rem' }}>▲</span>
                    <span>Defender</span>
                </button>
            </div>
        </div>
    );
}
