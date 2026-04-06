"use client";

import { useState, useRef } from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import culturesData from '../data/cultures.json';
import careersData from '../data/careers.json';
import stylesData from '../data/combatStyles.json';
import backgroundEventsData from '../data/backgroundEvents.json';

const parchmentBg = "https://www.transparenttextures.com/patterns/parchment.png";

// --- TYPES ---
interface Characteristics { STR: number; CON: number; SIZ: number; DEX: number; INT: number; POW: number; CHA: number; }
interface SkillSpend { culture: number; career: number; bonus: number; }
interface Pact { id: number; entity: string; dedicatedPow: number; gifts: string; compulsions: string; }

const standardSkillKeys = [
  "Athletics", "Boating", "Brawn", "Conceal", "Customs", "Dance", 
  "Deceit", "Drive", "Endurance", "Evade", "FirstAid", "Influence", 
  "Insight", "Locale", "NativeTongue", "Perception", "Ride", "Sing", 
  "Stealth", "Swim", "Unarmed", "Willpower"
];

const getProfSkillBase = (skillName: string, chars: Characteristics) => {
  const name = skillName.toLowerCase();
  if (name.includes('art') || name.includes('witch sight') || name.includes('devotion') || name.includes('pact')) return chars.POW + chars.CHA;
  if (name.includes('commerce') || name.includes('courtesy') || name.includes('language')) return chars.INT + chars.CHA;
  if (name.includes('craft')) return chars.DEX + chars.INT;
  if (name.includes('streetwise') || name.includes('binding') || name.includes('command')) return chars.POW + chars.CHA;
  if (name.includes('lore') || name.includes('locale') || name.includes('literacy')) return chars.INT * 2;
  if (name.includes('navigation') || name.includes('healing') || name.includes('rune casting') || name.includes('summoning')) return chars.INT + chars.POW;
  if (name.includes('survival') || name.includes('track')) return chars.CON + chars.POW;
  if (name.includes('trance') || name.includes('dreamtheft')) return chars.POW * 2;
  if (name.includes('combat style')) return chars.STR + chars.DEX;
  return chars.INT * 2;
};

const isMagicSkill = (skillName: string) => {
  const n = skillName.toLowerCase();
  return ['rune casting', 'summoning', 'command', 'pact', 'witch sight', 'devotion', 'trance', 'binding', 'dreamtheft'].some(m => n.includes(m));
};

const rollD6 = () => Math.floor(Math.random() * 6) + 1;
const rollStat = (dice: number, bonus: number) => {
  const rollOnce = () => Array.from({length: dice}, rollD6).reduce((a, b) => a + b, 0) + bonus;
  let firstRoll = rollOnce();
  if (firstRoll < 10) return Math.max(firstRoll, rollOnce());
  return firstRoll;
};

export default function CharacterBuilder() {
  const builderRef = useRef<HTMLDivElement>(null);
  const printPage1Ref = useRef<HTMLDivElement>(null);
  const printPage2Ref = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  // --- STATE (Including new RQ6 Bio Fields) ---
  const [name, setName] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [gender, setGender] = useState("");
  const [handedness, setHandedness] = useState("");
  const [frame, setFrame] = useState("");
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  
  const [race, setRace] = useState("Human");
  const [age, setAge] = useState(18);
  const [background, setBackground] = useState("");
  const [socialClass, setSocialClass] = useState("Freeman");
  const [money, setMoney] = useState("4d6 x 75 SP");
  const [connections, setConnections] = useState("");
  const [equipment, setEquipment] = useState("");
  
  const [characteristics, setCharacteristics] = useState<Characteristics>({ STR: 10, CON: 10, SIZ: 10, DEX: 10, INT: 10, POW: 10, CHA: 10 });
  const [selectedCulture, setSelectedCulture] = useState("");
  const [selectedCareer, setSelectedCareer] = useState("");
  const [passions, setPassions] = useState([{ id: 1, target: "Melniboné", val: 0 }]);
  const [pacts, setPacts] = useState<Pact[]>([{ id: 1, entity: "", dedicatedPow: 0, gifts: "", compulsions: "" }]);
  const [skillSpends, setSkillSpends] = useState<Record<string, SkillSpend>>({});
  const [skillSpecs, setSkillSpecs] = useState<Record<string, string>>({}); 
  
  const [customSkills, setCustomSkills] = useState<string[]>([]);
  const [newSkillBase, setNewSkillBase] = useState("Lore");
  const [newSkillSpec, setNewSkillSpec] = useState("");

  // --- DERIVED DATA ---
  let ageCategory = "Adult";
  let bonusSpendMax = 15;
  if (age < 17) { ageCategory = "Young"; bonusSpendMax = 10; }
  else if (age < 28) { ageCategory = "Adult"; bonusSpendMax = 15; }
  else if (age < 44) { ageCategory = "Middle Aged"; bonusSpendMax = 20; }
  else if (age < 65) { ageCategory = "Senior"; bonusSpendMax = 25; }
  else { ageCategory = "Old"; bonusSpendMax = 30; }

  const activeCulture = (culturesData as any[]).find(c => c.id === selectedCulture);
  const activeCareer = (careersData as any[]).find(c => c.id === selectedCareer);
  
  const allProfSkills = [...new Set([...(activeCulture?.professionalSkills || []), ...(activeCareer?.professionalSkills || []), ...customSkills])].sort();

  const charPoints = Object.values(characteristics).reduce((a, b) => a + b, 0);
  const cultureSpent = Object.values(skillSpends).reduce((acc, s) => acc + (s.culture || 0), 0);
  const careerSpent = Object.values(skillSpends).reduce((acc, s) => acc + (s.career || 0), 0);
  const bonusSpent = Object.values(skillSpends).reduce((acc, s) => acc + (s.bonus || 0), 0);

  // FILTERING LOGIC: Only show skills with points spent or custom hobbies
  const hasPointsSpent = (skill: string) => (skillSpends[skill]?.culture || 0) > 0 || (skillSpends[skill]?.career || 0) > 0 || (skillSpends[skill]?.bonus || 0) > 0;
  
  const activeMundaneProfs = allProfSkills.filter(s => (!isMagicSkill(s) && !s.includes("Combat Style")) && (hasPointsSpent(s) || customSkills.includes(s)));
  const activeMagicProfs = allProfSkills.filter(s => isMagicSkill(s) && (hasPointsSpent(s) || customSkills.includes(s)));
  const activeCombatStyles = allProfSkills.filter(s => s.includes("Combat Style") && (hasPointsSpent(s) || customSkills.includes(s)));

  const dedicatedMPs = pacts.reduce((sum, p) => sum + (Number(p.dedicatedPow) || 0), 0);
  const hpBase = Math.ceil((characteristics.CON + characteristics.SIZ) / 5);
  const actionPoints = characteristics.DEX + characteristics.INT <= 24 ? 2 : 3;
  const initiative = Math.ceil((characteristics.DEX + characteristics.INT) / 2);
  
  const strSiz = characteristics.STR + characteristics.SIZ;
  let damageMod = "+0";
  if (strSiz <= 5) damageMod = "-1d8";
  else if (strSiz <= 10) damageMod = "-1d6";
  else if (strSiz <= 15) damageMod = "-1d4";
  else if (strSiz <= 20) damageMod = "-1d2";
  else if (strSiz <= 25) damageMod = "+0";
  else if (strSiz <= 30) damageMod = "+1d2";
  else if (strSiz <= 35) damageMod = "+1d4";
  else if (strSiz <= 40) damageMod = "+1d6";
  else if (strSiz <= 45) damageMod = "+1d8";
  else if (strSiz <= 50) damageMod = "+1d10";
  else if (strSiz <= 60) damageMod = "+1d12";

  let healingRate = 1;
  if (characteristics.CON >= 6 && characteristics.CON <= 10) healingRate = 2;
  else if (characteristics.CON >= 11 && characteristics.CON <= 15) healingRate = 3;
  else if (characteristics.CON >= 16) healingRate = Math.ceil(characteristics.CON / 5);

  let luck = 1;
  if (characteristics.POW >= 7 && characteristics.POW <= 12) luck = 2;
  else if (characteristics.POW >= 13 && characteristics.POW <= 18) luck = 3;
  else if (characteristics.POW >= 19) luck = Math.ceil(characteristics.POW / 6);

  const getStandardBase = (s: string) => {
    const c = characteristics;
    if (s === "Customs" || s === "NativeTongue") return (c.INT * 2) + (selectedCulture ? 40 : 0);
    if (["Athletics", "Unarmed"].includes(s)) return c.STR + c.DEX;
    if (["Boating", "Swim"].includes(s)) return c.STR + c.CON;
    if (s === "Brawn") return c.STR + c.SIZ;
    if (["Conceal", "Drive", "Ride"].includes(s)) return c.DEX + c.POW;
    if (["Dance", "Deceit"].includes(s)) return c.INT + c.CHA;
    if (s === "Endurance") return c.CON * 2;
    if (s === "Evade") return c.DEX * 2;
    if (s === "FirstAid") return c.INT + c.DEX;
    if (s === "Influence") return c.CHA * 2;
    if (["Insight", "Perception"].includes(s)) return c.INT + c.POW;
    if (s === "Locale") return c.INT * 2;
    if (s === "Sing") return c.CHA + c.POW;
    if (s === "Stealth") return c.DEX + c.INT;
    if (s === "Willpower") return c.POW * 2;
    return 0;
  };

  const getTotalSkill = (skillName: string, base: number) => {
    const s = skillSpends[skillName] || { culture: 0, career: 0, bonus: 0 };
    return base + s.culture + s.career + s.bonus;
  };

  const displaySkillName = (name: string) => skillSpecs[name] ? `${name} (${skillSpecs[name]})` : name;

  const handleSkillChange = (skill: string, pool: keyof SkillSpend, value: number) => {
    setSkillSpends(prev => ({ ...prev, [skill]: { ...(prev[skill] || { culture: 0, career: 0, bonus: 0 }), [pool]: value } }));
  };

  const handleAddCustomSkill = () => {
    if (newSkillSpec.trim() === "") return;
    const skillName = newSkillBase === "Custom Professional" ? newSkillSpec : `${newSkillBase} (${newSkillSpec})`;
    if (!customSkills.includes(skillName)) setCustomSkills([...customSkills, skillName]);
    setNewSkillSpec("");
  };

  const removeCustomSkill = (skillToRemove: string) => {
    setCustomSkills(customSkills.filter(s => s !== skillToRemove));
    setSkillSpends(prev => { const updated = { ...prev }; delete updated[skillToRemove]; return updated; });
  };

  const handleRandomizeStats = () => {
    setCharacteristics({
      STR: rollStat(3, 0), CON: rollStat(3, 0), SIZ: rollStat(2, 6),
      DEX: rollStat(3, 0), INT: rollStat(2, 6), POW: rollStat(3, 0), CHA: rollStat(3, 0)
    });
  };

  // --- PDF EXPORT (2 PAGES + NATIVE ACROFORMS) ---
  const handleExportPDF = () => {
    if (!printPage1Ref.current || !printPage2Ref.current) return;
    setIsExporting(true);
    
    setTimeout(async () => {
      try {
        printPage1Ref.current!.style.display = 'block';
        printPage2Ref.current!.style.display = 'block';

        const canvas1 = await html2canvas(printPage1Ref.current!, { scale: 2, backgroundColor: '#ffffff' });
        const canvas2 = await html2canvas(printPage2Ref.current!, { scale: 2, backgroundColor: '#ffffff' });
        
        // A4 Dimensions in Points
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (canvas1.height * pdfWidth) / canvas1.width;
        
        // --- PAGE 1 ---
        pdf.addImage(canvas1.toDataURL('image/jpeg', 1.0), 'JPEG', 0, 0, pdfWidth, pdfHeight);
        
        // Add Form-Fillable AcroForm Fields on top of the image
        const addField = (fieldName: string, value: string, x: number, y: number, w: number, h: number) => {
            const field = new (pdf as any).AcroFormTextField();
            field.Rect = [x, y, w, h];
            field.value = value;
            field.fieldName = fieldName;
            field.fontSize = 10;
            pdf.addField(field);
        };

        // These coordinates are mapped roughly to the Top Bio Block of Page 1
        addField("PlayerName", playerName, 70, 75, 120, 16);
        addField("CharacterName", name, 70, 95, 120, 16);
        addField("Age", age.toString(), 70, 115, 120, 16);
        addField("Gender", gender, 70, 135, 120, 16);
        
        // --- PAGE 2 ---
        pdf.addPage();
        pdf.addImage(canvas2.toDataURL('image/jpeg', 1.0), 'JPEG', 0, 0, pdfWidth, pdfHeight);

        pdf.save(`${name || 'Elric_Character'}_Sheet.pdf`);

      } catch (error) {
        console.error("Failed to export PDF", error);
      } finally {
        printPage1Ref.current!.style.display = 'none';
        printPage2Ref.current!.style.display = 'none';
        setIsExporting(false);
      }
    }, 150);
  };

  // --- BUILDER UI COMPONENT ---
  const BuilderSkillRow = ({ skillName, base, type }: { skillName: string, base: number, type: string }) => {
    const s = skillSpends[skillName] || { culture: 0, career: 0, bonus: 0 };
    const total = base + s.culture + s.career + s.bonus;
    const isCustom = customSkills.includes(skillName);
    const exactNeedsSpec = ["Art", "Craft", "Language", "Lore", "Combat Style", "Rune Casting", "Summoning Ritual", "Command", "Pact"].includes(skillName);

    return (
      <tr className="border-b text-[10px]" style={{ borderColor: '#d1d5db' }}>
        <td className="p-1 font-bold flex justify-between items-center" style={{ color: '#000000' }}>
          <span className="flex items-center">
            {skillName}
            {exactNeedsSpec && (
              <input 
                className="ml-1 px-1 w-24 text-[9px] font-normal italic bg-transparent border-b outline-none" 
                style={{ borderColor: '#9ca3af', color: '#1d4ed8' }}
                placeholder="(specify...)" 
                value={skillSpecs[skillName] || ""} 
                onChange={e => setSkillSpecs({...skillSpecs, [skillName]: e.target.value})}
              />
            )}
          </span>
          {isCustom && <button onClick={() => removeCustomSkill(skillName)} className="font-bold px-1 ml-2 text-red-500 hover:opacity-100">×</button>}
        </td>
        <td className="text-center" style={{ color: '#6b7280' }}>{base}</td>
        <td className="text-center border-l"><input type="number" step={5} min="0" max="15" className="w-8 text-center bg-transparent outline-none" value={s.culture} onChange={e => handleSkillChange(skillName, 'culture', parseInt(e.target.value) || 0)} /></td>
        <td className="text-center border-l"><input type="number" step={5} min="0" max="15" className="w-8 text-center bg-transparent outline-none" value={s.career} onChange={e => handleSkillChange(skillName, 'career', parseInt(e.target.value) || 0)} /></td>
        <td className="text-center border-l"><input type="number" step={1} min="0" className="w-8 text-center bg-transparent outline-none" value={s.bonus} onChange={e => handleSkillChange(skillName, 'bonus', parseInt(e.target.value) || 0)} /></td>
        <td className="text-center font-bold border-l">{total}%</td>
      </tr>
    );
  };

  return (
    <>
      {/* -------------------------------------------------------------
          1. INTERACTIVE BUILDER VIEW
          ------------------------------------------------------------- */}
      <main className="min-h-screen p-4 font-serif" style={{ backgroundColor: "#ece0c8", backgroundImage: `url(${parchmentBg})`, display: isExporting ? 'none' : 'block' }}>
        <div className="max-w-7xl mx-auto flex justify-end mb-2">
          <button onClick={handleExportPDF} className="px-4 py-2 bg-black text-white text-xs font-bold uppercase tracking-widest shadow-md cursor-pointer">
            Download Form-Fillable 2-Page PDF
          </button>
        </div>

        <div className="max-w-7xl mx-auto border-4 border-black p-6 bg-white shadow-2xl">
          <header className="border-b-4 border-black mb-4 pb-2 flex justify-between items-end">
            <h1 className="text-4xl font-black uppercase tracking-tighter italic">Elric: Mythras Builder</h1>
          </header>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {/* COLUMN 1: BIO & BACKGROUND */}
            <section className="space-y-4">
              <div className="border-2 border-black p-2 bg-white">
                <h2 className="font-bold border-b border-black mb-2 uppercase text-[10px] text-red-900">Identity</h2>
                <input placeholder="Character Name" className="w-full text-xs border p-1 mb-1" value={name} onChange={e => setName(e.target.value)} />
                <input placeholder="Player Name" className="w-full text-xs border p-1 mb-1" value={playerName} onChange={e => setPlayerName(e.target.value)} />
                <div className="grid grid-cols-2 gap-1 mb-1">
                  <input placeholder="Gender" className="text-xs border p-1" value={gender} onChange={e => setGender(e.target.value)} />
                  <input placeholder="Handedness" className="text-xs border p-1" value={handedness} onChange={e => setHandedness(e.target.value)} />
                  <input placeholder="Height" className="text-xs border p-1" value={height} onChange={e => setHeight(e.target.value)} />
                  <input placeholder="Weight" className="text-xs border p-1" value={weight} onChange={e => setWeight(e.target.value)} />
                  <select className="text-xs border p-1" value={race} onChange={e => setRace(e.target.value)}><option>Human</option><option>Melnibonéan</option><option>Myyrrhn</option></select>
                  <input type="number" placeholder="Age" className="text-xs border p-1" value={age} onChange={e => setAge(parseInt(e.target.value) || 18)} />
                </div>
              </div>

              <div className="border-2 border-black p-2 bg-blue-50">
                <h2 className="font-bold border-b border-black mb-1 uppercase text-[10px] text-blue-900">Homeland & Class</h2>
                <select className="w-full text-xs border p-1 mb-1" value={selectedCulture} onChange={e => setSelectedCulture(e.target.value)}>
                  <option value="">Choose Kingdom...</option>
                  {(culturesData as any[]).map(c => <option key={c.id} value={c.id}>{c.kingdom}</option>)}
                </select>
                <select className="w-full text-xs border p-1 mb-1" value={selectedCareer} onChange={e => setSelectedCareer(e.target.value)}>
                  <option value="">Choose Career...</option>
                  {(careersData as any[]).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <div className="grid grid-cols-2 gap-1 mb-1">
                  <input placeholder="Social Class" className="text-[10px] border p-1 w-full" value={socialClass} onChange={e => setSocialClass(e.target.value)} />
                  <input placeholder="Starting SP" className="text-[10px] border p-1 w-full font-bold" value={money} onChange={e => setMoney(e.target.value)} />
                </div>
              </div>

              <div className="border-2 border-black p-2 bg-yellow-50">
                <h2 className="font-bold border-b border-black mb-1 uppercase text-[10px] flex justify-between">Background <button onClick={() => setBackground(backgroundEventsData[Math.floor(Math.random()*backgroundEventsData.length)])} className="px-1 text-[8px] bg-black text-white">Roll</button></h2>
                <textarea className="w-full text-[9px] p-1 outline-none border resize-none" rows={4} value={background} onChange={e => setBackground(e.target.value)} />
              </div>
            </section>

            {/* COLUMN 2: STATS */}
            <section className="space-y-4">
              <div className="border-2 border-black p-2 bg-white">
                <h2 className="font-bold border-b border-black mb-2 uppercase text-[10px] flex justify-between">Stats <button onClick={handleRandomizeStats} className="px-1 text-[8px] bg-black text-white">🎲 Roll</button></h2>
                <div className="grid grid-cols-2 gap-x-4">
                  {(Object.keys(characteristics) as (keyof Characteristics)[]).map(k => (
                    <div key={k} className="flex justify-between text-xs mb-1 border-b">
                      <span className="font-bold">{k}</span>
                      <input type="number" className="w-8 text-center font-black outline-none" value={characteristics[k]} onChange={e => setCharacteristics({...characteristics, [k]: parseInt(e.target.value) || 0})} />
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="border-2 border-black p-2 bg-pink-50">
                <h2 className="font-bold border-b border-black mb-2 uppercase text-[10px] text-pink-900">Pacts & Dedications</h2>
                {pacts.map((p, idx) => (
                  <div key={p.id} className="mb-2 border-b border-dashed pb-2">
                    <div className="flex gap-1 mb-1 items-center">
                      <input className="text-[10px] border flex-1 p-1" placeholder="Higher Power..." value={p.entity} onChange={e => { const n = [...pacts]; n[idx].entity = e.target.value; setPacts(n); }} />
                      <span className="text-[8px] font-bold">POW: <input type="number" className="w-8 border p-1" value={p.dedicatedPow} onChange={e => { const n = [...pacts]; n[idx].dedicatedPow = parseInt(e.target.value) || 0; setPacts(n); }} /></span>
                    </div>
                  </div>
                ))}
                <button onClick={() => setPacts([...pacts, { id: Date.now(), entity: "", dedicatedPow: 0, gifts: "", compulsions: "" }])} className="text-[8px] w-full py-1 bg-black text-white">+ Add Pact</button>
              </div>
            </section>

            {/* COLUMN 3 & 4: SKILLS */}
            <section className="md:col-span-2 border-2 border-black bg-white flex flex-col">
              <div className="p-1 flex justify-around text-[9px] font-bold uppercase bg-black text-white">
                <div>Cult: {cultureSpent}/100</div><div>Car: {careerSpent}/100</div><div>Bonus: {bonusSpent}</div>
              </div>
              <div className="overflow-y-auto max-h-[600px] p-2">
                <table className="w-full border-collapse">
                  <thead className="text-[9px] uppercase border-b text-left">
                    <tr><th className="p-1">Skill</th><th>Base</th><th className="text-center">C</th><th className="text-center">J</th><th className="text-center">B</th><th className="text-center">Total</th></tr>
                  </thead>
                  <tbody>
                    {standardSkillKeys.map(k => <BuilderSkillRow key={k} skillName={k} base={getStandardBase(k)} type="standard" />)}
                    <tr className="text-[9px] font-bold text-center uppercase bg-gray-100"><td colSpan={6} className="py-1">Professional & Combat Skills</td></tr>
                    {allProfSkills.filter(s => !isMagicSkill(s)).map(k => <BuilderSkillRow key={k} skillName={k} base={getProfSkillBase(k, characteristics)} type="prof" />)}
                    <tr className="text-[9px] font-bold text-center uppercase bg-red-50 text-red-900"><td colSpan={6} className="py-1">Magic & Runic Skills</td></tr>
                    {allProfSkills.filter(s => isMagicSkill(s)).map(k => <BuilderSkillRow key={k} skillName={k} base={getProfSkillBase(k, characteristics)} type="magic" />)}
                  </tbody>
                </table>
              </div>
              <div className="p-2 border-t bg-gray-50 flex gap-2 items-center">
                <span className="text-[9px] font-bold uppercase">Add Hobby:</span>
                <select className="border p-1 bg-white outline-none text-xs" value={newSkillBase} onChange={e => setNewSkillBase(e.target.value)}>
                  <option>Lore</option><option>Craft</option><option>Art</option><option>Combat Style</option><option>Rune Casting</option><option>Custom Professional</option>
                </select>
                <input className="border p-1 flex-1 outline-none text-xs" placeholder="Specify..." value={newSkillSpec} onChange={e => setNewSkillSpec(e.target.value)} />
                <button onClick={handleAddCustomSkill} className="px-3 py-1 font-bold text-white uppercase bg-black text-xs">Add</button>
              </div>
            </section>
          </div>
        </div>
      </main>

      {/* -------------------------------------------------------------
          2. HIDDEN PRINT VIEW - PAGE 1 (Core Stats & Mundane Skills)
          ------------------------------------------------------------- */}
      <div 
        ref={printPage1Ref} 
        style={{ display: 'none', width: '794px', height: '1123px', padding: '30px', backgroundColor: '#ffffff', color: '#000000', fontFamily: 'serif', boxSizing: 'border-box', position: 'relative' }}
      >
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundImage: `url(${parchmentBg})`, opacity: 0.3, zIndex: 0, pointerEvents: 'none' }} />
        
        <div style={{ position: 'relative', zIndex: 1 }}>
            <header style={{ borderBottom: '4px solid #000000', paddingBottom: '10px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', width: '350px' }}>
                    <div style={{ borderBottom: '1px solid #000', paddingBottom: '2px', display: 'flex', justifyContent: 'space-between' }}><strong style={{fontSize:'12px', textTransform:'uppercase'}}>Player:</strong> <span style={{fontStyle:'italic', fontSize:'14px'}}>{playerName}</span></div>
                    <div style={{ borderBottom: '1px solid #000', paddingBottom: '2px', display: 'flex', justifyContent: 'space-between' }}><strong style={{fontSize:'12px', textTransform:'uppercase'}}>Character:</strong> <span style={{fontStyle:'italic', fontSize:'14px'}}>{name}</span></div>
                    <div style={{ borderBottom: '1px solid #000', paddingBottom: '2px', display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{width:'33%'}}><strong style={{fontSize:'10px', textTransform:'uppercase'}}>Age:</strong> {age}</span>
                        <span style={{width:'33%'}}><strong style={{fontSize:'10px', textTransform:'uppercase'}}>Gender:</strong> {gender}</span>
                        <span style={{width:'33%'}}><strong style={{fontSize:'10px', textTransform:'uppercase'}}>Handed:</strong> {handedness}</span>
                    </div>
                    <div style={{ borderBottom: '1px solid #000', paddingBottom: '2px', display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{width:'33%'}}><strong style={{fontSize:'10px', textTransform:'uppercase'}}>Frame:</strong> {frame}</span>
                        <span style={{width:'33%'}}><strong style={{fontSize:'10px', textTransform:'uppercase'}}>Height:</strong> {height}</span>
                        <span style={{width:'33%'}}><strong style={{fontSize:'10px', textTransform:'uppercase'}}>Weight:</strong> {weight}</span>
                    </div>
                </div>

                <div style={{ textAlign: 'center' }}>
                    <h1 style={{ fontSize: '48px', margin: 0, fontWeight: 900, letterSpacing: '-1px', lineHeight: '1' }}>ELRIC!</h1>
                    <span style={{ fontSize: '12px', fontWeight: 'bold', letterSpacing: '2px' }}>RUNEQUEST SYSTEM</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', width: '250px' }}>
                    <div style={{ borderBottom: '1px solid #000', paddingBottom: '2px', display: 'flex', justifyContent: 'space-between' }}><strong style={{fontSize:'10px', textTransform:'uppercase'}}>Culture:</strong> <span>{activeCulture?.kingdom}</span></div>
                    <div style={{ borderBottom: '1px solid #000', paddingBottom: '2px', display: 'flex', justifyContent: 'space-between' }}><strong style={{fontSize:'10px', textTransform:'uppercase'}}>Career:</strong> <span>{activeCareer?.name}</span></div>
                    <div style={{ borderBottom: '1px solid #000', paddingBottom: '2px', display: 'flex', justifyContent: 'space-between' }}><strong style={{fontSize:'10px', textTransform:'uppercase'}}>Social Class:</strong> <span>{socialClass}</span></div>
                </div>
            </header>

            {/* STATS & HIT LOCATIONS */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '20px', marginBottom: '20px' }}>
                <div>
                    <h3 style={{ backgroundColor: '#000', color: '#fff', textAlign: 'center', margin: 0, padding: '4px', fontSize: '12px', textTransform: 'uppercase' }}>Characteristics & Attributes</h3>
                    <table style={{ width: '100%', border: '2px solid #000', borderCollapse: 'collapse', fontSize: '12px' }}>
                        <tbody>
                            <tr><td style={{ padding: '4px', border: '1px solid #000', fontWeight: 'bold' }}>STR</td><td style={{ border: '1px solid #000', textAlign: 'center', fontSize: '16px', fontWeight: 'bold' }}>{characteristics.STR}</td><td style={{ padding: '4px', border: '1px solid #000', fontWeight: 'bold' }}>Action Pts</td><td style={{ border: '1px solid #000', textAlign: 'center', fontSize: '14px', fontWeight: 'bold' }}>{actionPoints}</td></tr>
                            <tr style={{backgroundColor:'#f9f9f9'}}><td style={{ padding: '4px', border: '1px solid #000', fontWeight: 'bold' }}>CON</td><td style={{ border: '1px solid #000', textAlign: 'center', fontSize: '16px', fontWeight: 'bold' }}>{characteristics.CON}</td><td style={{ padding: '4px', border: '1px solid #000', fontWeight: 'bold' }}>Damage Mod</td><td style={{ border: '1px solid #000', textAlign: 'center', fontSize: '14px', fontWeight: 'bold' }}>{damageMod}</td></tr>
                            <tr><td style={{ padding: '4px', border: '1px solid #000', fontWeight: 'bold' }}>SIZ</td><td style={{ border: '1px solid #000', textAlign: 'center', fontSize: '16px', fontWeight: 'bold' }}>{characteristics.SIZ}</td><td style={{ padding: '4px', border: '1px solid #000', fontWeight: 'bold' }}>Magic Pts</td><td style={{ border: '1px solid #000', textAlign: 'center', fontSize: '14px', fontWeight: 'bold' }}>{characteristics.POW - dedicatedMPs}</td></tr>
                            <tr style={{backgroundColor:'#f9f9f9'}}><td style={{ padding: '4px', border: '1px solid #000', fontWeight: 'bold' }}>DEX</td><td style={{ border: '1px solid #000', textAlign: 'center', fontSize: '16px', fontWeight: 'bold' }}>{characteristics.DEX}</td><td style={{ padding: '4px', border: '1px solid #000', fontWeight: 'bold' }}>Strike Rank</td><td style={{ border: '1px solid #000', textAlign: 'center', fontSize: '14px', fontWeight: 'bold' }}>{initiative}</td></tr>
                            <tr><td style={{ padding: '4px', border: '1px solid #000', fontWeight: 'bold' }}>INT</td><td style={{ border: '1px solid #000', textAlign: 'center', fontSize: '16px', fontWeight: 'bold' }}>{characteristics.INT}</td><td style={{ padding: '4px', border: '1px solid #000', fontWeight: 'bold' }}>Luck</td><td style={{ border: '1px solid #000', textAlign: 'center', fontSize: '14px', fontWeight: 'bold' }}>{luck}</td></tr>
                            <tr style={{backgroundColor:'#f9f9f9'}}><td style={{ padding: '4px', border: '1px solid #000', fontWeight: 'bold' }}>POW</td><td style={{ border: '1px solid #000', textAlign: 'center', fontSize: '16px', fontWeight: 'bold' }}>{characteristics.POW}</td><td style={{ padding: '4px', border: '1px solid #000', fontWeight: 'bold' }}>Healing Rate</td><td style={{ border: '1px solid #000', textAlign: 'center', fontSize: '14px', fontWeight: 'bold' }}>{healingRate}</td></tr>
                            <tr><td style={{ padding: '4px', border: '1px solid #000', fontWeight: 'bold' }}>CHA</td><td style={{ border: '1px solid #000', textAlign: 'center', fontSize: '16px', fontWeight: 'bold' }}>{characteristics.CHA}</td><td style={{ padding: '4px', border: '1px solid #000', fontWeight: 'bold' }}>Movement</td><td style={{ border: '1px solid #000', textAlign: 'center', fontSize: '14px', fontWeight: 'bold' }}>{movement}</td></tr>
                        </tbody>
                    </table>
                </div>

                <div>
                    <h3 style={{ backgroundColor: '#000', color: '#fff', textAlign: 'center', margin: 0, padding: '4px', fontSize: '12px', textTransform: 'uppercase' }}>Hit Locations</h3>
                    <table style={{ width: '100%', border: '2px solid #000', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'center' }}>
                        <thead><tr style={{borderBottom:'2px solid #000'}}><th style={{ borderRight: '1px solid #000' }}>1d20</th><th style={{ borderRight: '1px solid #000', textAlign: 'left', paddingLeft: '4px' }}>Location</th><th style={{ borderRight: '1px solid #000' }}>AP</th><th>HP</th></tr></thead>
                        <tbody>
                            <tr><td style={{ borderRight: '1px solid #000', borderBottom: '1px dotted #000', padding:'6px' }}>1-3</td><td style={{ borderRight: '1px solid #000', borderBottom: '1px dotted #000', textAlign: 'left', paddingLeft: '4px' }}>Right Leg</td><td style={{ borderRight: '1px solid #000', borderBottom: '1px dotted #000' }}></td><td style={{ borderBottom: '1px dotted #000', fontWeight: 'bold', fontSize:'14px' }}>{hpBase}</td></tr>
                            <tr style={{backgroundColor:'#f9f9f9'}}><td style={{ borderRight: '1px solid #000', borderBottom: '1px dotted #000', padding:'6px' }}>4-6</td><td style={{ borderRight: '1px solid #000', borderBottom: '1px dotted #000', textAlign: 'left', paddingLeft: '4px' }}>Left Leg</td><td style={{ borderRight: '1px solid #000', borderBottom: '1px dotted #000' }}></td><td style={{ borderBottom: '1px dotted #000', fontWeight: 'bold', fontSize:'14px' }}>{hpBase}</td></tr>
                            <tr><td style={{ borderRight: '1px solid #000', borderBottom: '1px dotted #000', padding:'6px' }}>7-9</td><td style={{ borderRight: '1px solid #000', borderBottom: '1px dotted #000', textAlign: 'left', paddingLeft: '4px' }}>Abdomen</td><td style={{ borderRight: '1px solid #000', borderBottom: '1px dotted #000' }}></td><td style={{ borderBottom: '1px dotted #000', fontWeight: 'bold', fontSize:'14px' }}>{hpBase+1}</td></tr>
                            <tr style={{backgroundColor:'#f9f9f9'}}><td style={{ borderRight: '1px solid #000', borderBottom: '1px dotted #000', padding:'6px' }}>10-12</td><td style={{ borderRight: '1px solid #000', borderBottom: '1px dotted #000', textAlign: 'left', paddingLeft: '4px' }}>Chest</td><td style={{ borderRight: '1px solid #000', borderBottom: '1px dotted #000' }}></td><td style={{ borderBottom: '1px dotted #000', fontWeight: 'bold', fontSize:'14px' }}>{hpBase+2}</td></tr>
                            <tr><td style={{ borderRight: '1px solid #000', borderBottom: '1px dotted #000', padding:'6px' }}>13-15</td><td style={{ borderRight: '1px solid #000', borderBottom: '1px dotted #000', textAlign: 'left', paddingLeft: '4px' }}>Right Arm</td><td style={{ borderRight: '1px solid #000', borderBottom: '1px dotted #000' }}></td><td style={{ borderBottom: '1px dotted #000', fontWeight: 'bold', fontSize:'14px' }}>{Math.max(1, hpBase-1)}</td></tr>
                            <tr style={{backgroundColor:'#f9f9f9'}}><td style={{ borderRight: '1px solid #000', borderBottom: '1px dotted #000', padding:'6px' }}>16-18</td><td style={{ borderRight: '1px solid #000', borderBottom: '1px dotted #000', textAlign: 'left', paddingLeft: '4px' }}>Left Arm</td><td style={{ borderRight: '1px solid #000', borderBottom: '1px dotted #000' }}></td><td style={{ borderBottom: '1px dotted #000', fontWeight: 'bold', fontSize:'14px' }}>{Math.max(1, hpBase-1)}</td></tr>
                            <tr><td style={{ borderRight: '1px solid #000', padding:'6px' }}>19-20</td><td style={{ borderRight: '1px solid #000', textAlign: 'left', paddingLeft: '4px' }}>Head</td><td style={{ borderRight: '1px solid #000' }}></td><td style={{ fontWeight: 'bold', fontSize:'14px' }}>{hpBase}</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* COMBAT STYLES */}
            <div style={{ marginBottom: '20px', border: '2px solid #000' }}>
              <h3 style={{ backgroundColor: '#000', color: '#fff', textAlign: 'center', margin: 0, padding: '4px', fontSize: '12px', textTransform: 'uppercase' }}>Combat Styles (STR+DEX)</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'center' }}>
                <thead><tr style={{borderBottom:'1px solid #000'}}><th style={{padding:'4px', textAlign:'left', borderRight:'1px solid #000'}}>Style Name</th><th style={{borderRight:'1px solid #000'}}>%</th><th style={{textAlign:'left', paddingLeft:'4px'}}>Weapons & Traits</th></tr></thead>
                <tbody>
                  {activeCombatStyles.length === 0 && <tr><td colSpan={3} style={{padding:'10px', fontStyle:'italic'}}>No Combat Styles learned.</td></tr>}
                  {activeCombatStyles.map((s, i) => (
                    <tr key={s} style={{ borderBottom: '1px dotted #000', backgroundColor: i%2===0?'#fff':'#f9f9f9' }}>
                      <td style={{padding:'6px', textAlign:'left', borderRight:'1px solid #000', fontWeight:'bold'}}>{displaySkillName(s)}</td>
                      <td style={{borderRight:'1px solid #000', fontWeight:'bold', fontSize:'14px'}}>{getTotalSkill(s, getProfSkillBase(s, characteristics))}%</td>
                      <td style={{textAlign:'left', paddingLeft:'4px'}}></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* MUNDANE SKILLS */}
            <div style={{ border: '2px solid #000' }}>
              <h3 style={{ backgroundColor: '#000', color: '#fff', textAlign: 'center', margin: 0, padding: '4px', fontSize: '12px', textTransform: 'uppercase' }}>Skills</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', padding: '10px' }}>
                  <div>
                      <h4 style={{ borderBottom: '2px solid #000', margin: '0 0 5px 0', fontSize: '10px', textTransform: 'uppercase' }}>Standard Skills</h4>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                          <tbody>
                              {standardSkillKeys.map(k => (
                                  <tr key={k} style={{ borderBottom: '1px dotted #000' }}>
                                      <td style={{ padding: '3px 0' }}>{k}</td>
                                      <td style={{ textAlign: 'right', fontWeight: 'bold', fontSize: '12px' }}>{getTotalSkill(k, getStandardBase(k))}%</td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  </div>
                  <div>
                      <h4 style={{ borderBottom: '2px solid #000', margin: '0 0 5px 0', fontSize: '10px', textTransform: 'uppercase' }}>Professional Skills</h4>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                          <tbody>
                              {activeMundaneProfs.length === 0 && <tr><td style={{ fontStyle: 'italic', padding: '4px' }}>No points spent.</td></tr>}
                              {activeMundaneProfs.map(k => (
                                  <tr key={k} style={{ borderBottom: '1px dotted #000' }}>
                                      <td style={{ padding: '3px 0' }}>{displaySkillName(k)}</td>
                                      <td style={{ textAlign: 'right', fontWeight: 'bold', fontSize: '12px' }}>{getTotalSkill(k, getProfSkillBase(k, characteristics))}%</td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  </div>
              </div>
            </div>
        </div>
      </div>

      {/* -------------------------------------------------------------
          3. HIDDEN PRINT VIEW - PAGE 2 (Magic, Gear, Background)
          ------------------------------------------------------------- */}
      <div 
        ref={printPage2Ref} 
        style={{ display: 'none', width: '794px', height: '1123px', padding: '30px', backgroundColor: '#ffffff', color: '#000000', fontFamily: 'serif', boxSizing: 'border-box', position: 'relative' }}
      >
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundImage: `url(${parchmentBg})`, opacity: 0.3, zIndex: 0, pointerEvents: 'none' }} />
        
        <div style={{ position: 'relative', zIndex: 1 }}>
            <header style={{ borderBottom: '4px solid #000000', paddingBottom: '10px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div><h1 style={{ fontSize: '32px', margin: 0, fontWeight: 900, lineHeight:'1' }}>ELRIC!</h1></div>
                <div style={{ fontSize: '14px', fontWeight: 'bold', letterSpacing:'1px' }}>PAGE 2: MYTHOS & INVENTORY</div>
            </header>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                
                {/* MAGIC SKILLS & PACTS */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div style={{ border: '2px solid #000' }}>
                      <h3 style={{ backgroundColor: '#000', color: '#fff', textAlign: 'center', margin: 0, padding: '4px', fontSize: '12px', textTransform: 'uppercase' }}>Magical Skills</h3>
                      <div style={{padding:'10px'}}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                            <tbody>
                                {activeMagicProfs.length === 0 && <tr><td style={{ fontStyle: 'italic', padding: '4px' }}>No magical skills learned.</td></tr>}
                                {activeMagicProfs.map(k => (
                                    <tr key={k} style={{ borderBottom: '1px dotted #000' }}>
                                        <td style={{ padding: '4px 0' }}>{displaySkillName(k)}</td>
                                        <td style={{ textAlign: 'right', fontWeight: 'bold', fontSize:'14px' }}>{getTotalSkill(k, getProfSkillBase(k, characteristics))}%</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                      </div>
                    </div>

                    <div style={{ border: '2px solid #000', flex: 1 }}>
                      <h3 style={{ backgroundColor: '#000', color: '#fff', textAlign: 'center', margin: 0, padding: '4px', fontSize: '12px', textTransform: 'uppercase' }}>Pacts & Cults</h3>
                      <div style={{ padding: '10px', fontSize: '11px' }}>
                          {pacts.filter(p => p.entity).length === 0 ? <i>No Pacts forged.</i> : 
                              pacts.filter(p => p.entity).map((p, i) => (
                                  <div key={i} style={{ borderBottom: '1px solid #000', paddingBottom: '8px', marginBottom: '8px' }}>
                                      <div style={{display:'flex', justifyContent:'space-between', marginBottom:'4px', fontSize:'12px'}}>
                                        <strong>{p.entity}</strong> 
                                        <strong>POW: {p.dedicatedPow}</strong>
                                      </div>
                                      <div><em>Gifts:</em> {p.gifts || "None"}</div>
                                      <div><em>Compulsions:</em> {p.compulsions || "None"}</div>
                                  </div>
                              ))
                          }
                      </div>
                    </div>
                </div>

                {/* PASSIONS, GEAR & WEALTH */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div style={{ border: '2px solid #000' }}>
                      <h3 style={{ backgroundColor: '#000', color: '#fff', textAlign: 'center', margin: 0, padding: '4px', fontSize: '12px', textTransform: 'uppercase' }}>Passions</h3>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                          <tbody>
                              {passions.map((p, i) => (
                                  <tr key={i} style={{ borderBottom: '1px solid #000' }}>
                                      <td style={{ padding: '6px' }}>{p.target}</td>
                                      <td style={{ textAlign: 'center', borderLeft: '1px solid #000', fontWeight: 'bold', width:'25%', fontSize:'14px' }}>{characteristics.POW + characteristics.CHA + 30}%</td>
                                  </tr>
                              ))}
                              {[...Array(Math.max(0, 3 - passions.length))].map((_, i) => (
                                  <tr key={`empty-${i}`} style={{ borderBottom: '1px solid #000' }}>
                                      <td style={{ padding: '6px' }}>&nbsp;</td>
                                      <td style={{ borderLeft: '1px solid #000' }}></td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                    </div>

                    <div style={{ border: '2px solid #000', flex: 1 }}>
                      <h3 style={{ backgroundColor: '#000', color: '#fff', textAlign: 'center', margin: 0, padding: '4px', fontSize: '12px', textTransform: 'uppercase' }}>Equipment & Wealth</h3>
                      <div style={{ padding: '10px', fontSize: '11px', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>
                          <strong>Starting Money:</strong> {money}<br/><br/>
                          {equipment}
                      </div>
                    </div>
                </div>
            </div>

            {/* WEAPONS TABLE */}
            <div style={{ border: '2px solid #000', marginBottom: '20px' }}>
              <h3 style={{ backgroundColor: '#000', color: '#fff', textAlign: 'center', margin: 0, padding: '4px', fontSize: '12px', textTransform: 'uppercase' }}>Weapons Table</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'center' }}>
                <thead>
                  <tr style={{borderBottom:'2px solid #000'}}>
                    <th style={{padding:'6px', textAlign:'left', borderRight:'1px solid #000'}}>Weapon</th>
                    <th style={{borderRight:'1px solid #000'}}>Damage</th>
                    <th style={{borderRight:'1px solid #000'}}>Reach/Size</th>
                    <th style={{borderRight:'1px solid #000'}}>Effects</th>
                    <th style={{borderRight:'1px solid #000'}}>AP/HP</th>
                    <th>ENC</th>
                  </tr>
                </thead>
                <tbody>
                  {[...Array(5)].map((_, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #000' }}>
                      <td style={{ padding: '12px', borderRight: '1px solid #000' }}></td>
                      <td style={{ padding: '12px', borderRight: '1px solid #000' }}></td>
                      <td style={{ padding: '12px', borderRight: '1px solid #000' }}></td>
                      <td style={{ padding: '12px', borderRight: '1px solid #000' }}></td>
                      <td style={{ padding: '12px', borderRight: '1px solid #000' }}></td>
                      <td style={{ padding: '12px' }}></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* BACKGROUND & NOTES */}
            <div style={{ border: '2px solid #000' }}>
                <h3 style={{ backgroundColor: '#000', color: '#fff', textAlign: 'center', margin: 0, padding: '4px', fontSize: '12px', textTransform: 'uppercase' }}>Background & Connections</h3>
                <div style={{ padding: '10px', minHeight: '150px', fontSize: '12px', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>
                    <em>{background}</em><br/><br/>{connections}
                </div>
            </div>
        </div>
      </div>
    </>
  );
}