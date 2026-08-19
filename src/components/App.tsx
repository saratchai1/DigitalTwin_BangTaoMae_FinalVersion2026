import { Viewer } from "@itwin/web-viewer-react";
import { useAuthorizationContext } from "./Authorization";
import { getUiProviders } from "./ViewerTools";
import { TreeWidget } from "@itwin/tree-widget-react";
import { PropertyGridManager } from "@itwin/property-grid-react";
import { MeasureTools } from "@itwin/measure-tools-react";
import { MapLayersUI } from "@itwin/map-layers";
import { IModelApp } from "@itwin/core-frontend";
import { useEffect, useState, useMemo } from "react";
import { AlertCircle, Camera, CloudRain, Droplets, LayoutDashboard, Leaf, Map, Navigation, Play, Pause, RefreshCw, RotateCcw, Settings, Sun, Wind, Wrench, Gauge, Waves, CloudFog, Monitor, Activity, ArrowUp, ArrowDown, Minus, Thermometer, Compass } from "lucide-react";
import { Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from 'recharts';

export interface AppProps {
  iTwinId: string;
  iModelId: string;
  changesetId?: string;
}

import { WaterProfile3D } from "./WaterProfile3D";

const aqiHistoryData = [
  { day: 'Mon', aqi: 45, pm25: 12 },
  { day: 'Tue', aqi: 52, pm25: 15 },
  { day: 'Wed', aqi: 38, pm25: 10 },
  { day: 'Thu', aqi: 65, pm25: 22 },
  { day: 'Fri', aqi: 48, pm25: 14 },
  { day: 'Sat', aqi: 42, pm25: 11 },
  { day: 'Sun', aqi: 50, pm25: 15 },
];

const CustomTooltip = ({ active, payload, label, name, unit }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-gray-300 p-2 rounded shadow-sm text-xs z-50">
        <p className="text-gray-500 mb-1">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} style={{ color: entry.color }}>
            {name || entry.name} : {Number(entry.value).toFixed(2)} {unit}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

const SensorCard = ({ title, value, unit, icon, data, color, gradient, subtitle }: any) => {
  return (
    <div className="bg-panel/80 backdrop-blur-md rounded-xl p-4 border border-border/50 shadow-lg flex flex-col h-64 transition-all duration-300 hover:shadow-xl hover:border-accent">
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center text-text-muted">
          <div className="bg-main/50 p-2 rounded-lg mr-3 shadow-inner">
            {icon}
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-text-main">{title}</h3>
            {subtitle && <div className="text-[10px] text-text-muted">{subtitle}</div>}
          </div>
        </div>
        <div className="text-right">
          <span className="text-3xl font-bold font-mono tracking-tighter text-text-main">{value !== null ? value.toFixed(1) : '--'}</span>
          {unit && <span className="text-xs font-bold text-text-muted ml-1">{unit}</span>}
        </div>
      </div>
      <div className="flex-1 relative -mx-4 -mb-4 mt-2">
        {data && data.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color} stopOpacity={0.4}/>
                  <stop offset="95%" stopColor={color} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="time" hide />
              <YAxis domain={['auto', 'auto']} hide />
              <Tooltip 
                contentStyle={{ backgroundColor: 'var(--color-panel)', borderColor: 'var(--color-border)', fontSize: '12px', borderRadius: '12px', backdropFilter: 'blur(8px)' }}
                itemStyle={{ color: 'var(--color-text-main)', fontWeight: 'bold' }}
                labelStyle={{ color: 'var(--color-text-muted)', marginBottom: '4px' }}
                formatter={(val: any) => [`${Number(val).toFixed(1)} ${unit}`, title]}
              />
              <Area type="monotone" dataKey="value" stroke={color} strokeWidth={3} fillOpacity={1} fill={`url(#${gradient})`} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-full text-xs font-bold tracking-widest text-text-muted">NO DATA</div>
        )}
      </div>
    </div>
  );
};

export function App(props: AppProps) {
  const { client } = useAuthorizationContext();
  const [time, setTime] = useState(new Date());
  const [simTime, setSimTime] = useState(new Date());
  const [isSimulating, setIsSimulating] = useState(false);
  const [isSimulationMode, setIsSimulationMode] = useState(false);
  const [simAlerts, setSimAlerts] = useState<{id: number, message: string, type: 'danger' | 'warning' | 'success', time: string}[]>([]);

  const [activeMenu, setActiveMenu] = useState('water-management');
  const [theme, setTheme] = useState('theme-default');

  const [flowMeterData, setFlowMeterData] = useState(() => Array.from({ length: 50 }, (_, i) => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - (50 - i) * 5);
    return {
      time: d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
      fm01: 410 + Math.random() * 5,
      fm02: 378 + Math.random() * 4,
    };
  }));

  const [waterQualityData, setWaterQualityData] = useState(() => Array.from({ length: 50 }, (_, i) => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - (50 - i) * 5);
    return {
      time: d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
      do: 7.3 + Math.random() * 0.2,
      turbidity: 16.0 + Math.random() * 1.0,
      ph: 7.4 + Math.random() * 0.1,
    };
  }));

  const [waterStations, setWaterStations] = useState([
    { id: 'WL01', name: 'อ่างเก็บน้ำบางเท่าแม่', val: 86.47, baseMSL: 79.50, warningLevel: 90.00, criticalLevel: 90.64, type: 'wl', trend: 'stable' },
    { id: 'WL03', name: 'กม.1+270', val: 64.74, baseMSL: 62.770, warningLevel: 63.8, criticalLevel: 64.033, type: 'wl', trend: 'up' },
    { id: 'WL06', name: 'กม.4+225', val: 48.16, baseMSL: 46.00, warningLevel: 49.0, criticalLevel: 49.5, type: 'wl', trend: 'up' },
    { id: 'WL08', name: 'กม.7+389', val: 31.88, baseMSL: 30.00, warningLevel: 32.0, criticalLevel: 32.5, type: 'wl', trend: 'up' },
    { id: 'TANK01', name: 'ถังเก็บน้ำ 3000 ลบ.ม.', val: 3.00, baseMSL: 0, warningLevel: 5.0, criticalLevel: 5.8, type: 'tank', trend: 'stable' },
    { id: 'TANK02', name: 'ถังเก็บน้ำ 3000 ลบ.ม.', val: 3.39, baseMSL: 0, warningLevel: 5.0, criticalLevel: 5.8, type: 'tank', trend: 'stable' },
  ]);

  useEffect(() => {
    document.body.className = theme;
  }, [theme]);
  
  const [weather, setWeather] = useState({
    temp: null as number | null, 
    humidity: null as number | null,
    pressure: null as number | null,
    windSpeed: null as number | null,
    windDir: 0,
    rain: null as number | null,
    rainAccum: null as number | null, 
    chanceRain: null as number | null, 
    pm25: null as number | null,
    pm10: null as number | null,
    uv: null as number | null,
    solar: null as number | null,
    aqi: null as number | null,
    condition: 'Waiting for Data...',
    lastUpdate: null as string | null
  });

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [historyData, setHistoryData] = useState<any>({});

  useEffect(() => {
    const generateHistoryData = (currentValue: number | null, variance: number) => {
      if (currentValue === null) return [];
      const now = new Date();
      const chronoData = [];
      
      for (let i = 0; i < 24; i++) {
         chronoData.push({
            time: new Date(now.getTime() - (23 - i) * 60 * 60 * 1000).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
            value: 0
         });
      }
      
      chronoData[23].value = currentValue;
      for(let i=22; i>=0; i--) {
          chronoData[i].value = Math.max(0, chronoData[i+1].value + (Math.random() * variance * 2 - variance));
      }

      return chronoData;
    };

    setHistoryData({
      aqi: generateHistoryData(weather.aqi, 5),
      pm25: generateHistoryData(weather.pm25, 2),
      pm10: generateHistoryData(weather.pm10, 3),
      uv: generateHistoryData(weather.uv, 1),
      temp: generateHistoryData(weather.temp, 1),
      humidity: generateHistoryData(weather.humidity, 2),
      pressure: generateHistoryData(weather.pressure, 1),
      rain: generateHistoryData(weather.rain, 0.5),
      wind: generateHistoryData(weather.windSpeed, 2),
    });
  }, [weather]);

  const windRoseData = useMemo(() => {
    const data = [
      { direction: 'N', value: 10 },
      { direction: 'NE', value: 10 },
      { direction: 'E', value: 10 },
      { direction: 'SE', value: 10 },
      { direction: 'S', value: 10 },
      { direction: 'SW', value: 10 },
      { direction: 'W', value: 10 },
      { direction: 'NW', value: 10 },
    ];
    if (weather.windDir !== null) {
      const idx = Math.round(weather.windDir / 45) % 8;
      data[idx].value = 80;
      data[(idx + 1) % 8].value = 40;
      data[(idx + 7) % 8].value = 40;
    }
    return data;
  }, [weather.windDir]);

  const fetchRealWeatherData = async () => {
    if (isSimulationMode) return;
    
    const lat = 8.533;
    const lon = 98.867;
    
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,rain,surface_pressure,wind_speed_10m,wind_direction_10m,uv_index,shortwave_radiation,cloud_cover&hourly=precipitation_probability&daily=rain_sum&timezone=Asia%2FBangkok`;
    const airUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=us_aqi,pm2_5,pm10&timezone=Asia%2FBangkok`;

    // Use current state as base or fallback values
    let newWeather = { 
        ...weather,
        temp: weather.temp ?? 32.5,
        humidity: weather.humidity ?? 68,
        pressure: weather.pressure ?? 1010,
        windSpeed: weather.windSpeed ?? 12.5,
        windDir: weather.windDir ?? 210,
        rain: weather.rain ?? 0,
        rainAccum: weather.rainAccum ?? 5.2,
        chanceRain: weather.chanceRain ?? 20,
        uv: weather.uv ?? 8,
        solar: weather.solar ?? 650,
        pm25: weather.pm25 ?? 15.4,
        pm10: weather.pm10 ?? 22.1,
        aqi: weather.aqi ?? 42,
        condition: weather.condition === 'Waiting for Data...' ? 'Partly Cloudy (Fallback)' : weather.condition
    };

    try {
        const weatherRes = await fetch(weatherUrl);
        if (weatherRes.ok) {
            const weatherData = await weatherRes.json();
            if (weatherData.current) {
                const currentHourIndex = new Date().getHours();
                const chanceRain = weatherData.hourly?.precipitation_probability?.[currentHourIndex] || 0;
                
                newWeather = {
                    ...newWeather,
                    temp: weatherData.current.temperature_2m,
                    humidity: weatherData.current.relative_humidity_2m,
                    pressure: weatherData.current.surface_pressure,
                    windSpeed: weatherData.current.wind_speed_10m,
                    windDir: weatherData.current.wind_direction_10m,
                    rain: weatherData.current.rain,
                    rainAccum: weatherData.daily?.rain_sum?.[0] || 0, 
                    chanceRain, 
                    uv: weatherData.current.uv_index,
                    solar: weatherData.current.shortwave_radiation,
                    condition: weatherData.current.rain > 0 ? 'Raining' : (weatherData.current.cloud_cover > 50 ? 'Cloudy' : 'Clear Sky'),
                };
            }
        }
    } catch (e) {
        // Silently fallback if weather API fails
    }

    try {
        const airRes = await fetch(airUrl);
        if (airRes.ok) {
            const airData = await airRes.json();
            if (airData.current) {
                newWeather = {
                    ...newWeather,
                    pm25: airData.current.pm2_5,
                    pm10: airData.current.pm10,
                    aqi: airData.current.us_aqi,
                };
            }
        }
    } catch (e) {
        // Silently fallback if air quality API fails
    }

    newWeather.lastUpdate = new Date().toLocaleTimeString('th-TH');
    setWeather(newWeather);
  };

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await fetchRealWeatherData();
    setTimeout(() => setIsRefreshing(false), 800);
  };

  useEffect(() => {
    void fetchRealWeatherData();
    const weatherTimer = setInterval(() => { void fetchRealWeatherData(); }, 300000); // 5 mins
    return () => {
      clearInterval(weatherTimer);
    };
  }, [isSimulationMode]);

  // Live Time Tick
  useEffect(() => {
    const timer = setInterval(() => {
      if (!isSimulationMode) {
        setTime(new Date());
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [isSimulationMode]);

  // Simulation Tick
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isSimulating) {
      timer = setInterval(() => {
        setSimTime(prev => {
          const nextTime = new Date(prev.getTime() + 12 * 60000); // +12 mins per second
          
          // Randomly generate alerts
          if (Math.random() > 0.95) {
            const alertTypes = [
              { msg: 'Heavy rain detected at station WL01', type: 'warning' as const },
              { msg: 'Water level critical at WL03', type: 'danger' as const },
              { msg: 'Sensor FM02 signal lost', type: 'danger' as const },
              { msg: 'Water quality DO dropped below normal', type: 'warning' as const },
            ];
            const randomAlert = alertTypes[Math.floor(Math.random() * alertTypes.length)];
            setSimAlerts(alerts => [{
              id: Date.now(),
              message: randomAlert.msg,
              type: randomAlert.type,
              time: nextTime.toLocaleTimeString('en-US', { hour12: false })
            }, ...alerts].slice(0, 5));
          }

          // Update Data Arrays
          setFlowMeterData(prevData => {
            const newData = [...prevData.slice(1)];
            newData.push({
              time: nextTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
              fm01: 410 + Math.random() * 20 - 10,
              fm02: 378 + Math.random() * 15 - 7.5,
            });
            return newData;
          });

          setWaterQualityData(prevData => {
            const newData = [...prevData.slice(1)];
            newData.push({
              time: nextTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
              do: Math.max(0, 7.3 + Math.random() * 1.0 - 0.5),
              turbidity: Math.max(0, 16.0 + Math.random() * 5.0 - 2.5),
              ph: Math.max(0, Math.min(14, 7.4 + Math.random() * 0.4 - 0.2)),
            });
            return newData;
          });

          // Update Water Stations
          setWaterStations(prevStations => prevStations.map(st => {
            const change = (Math.random() * 0.4) - 0.15; // Trend slightly upwards
            const newVal = Math.max(st.baseMSL, st.val + change);
            return {
              ...st,
              val: newVal,
              trend: change > 0.05 ? 'up' : change < -0.05 ? 'down' : 'stable'
            };
          }));

          // Update Weather
          setWeather(prev => ({
            ...prev,
            temp: prev.temp ? prev.temp + (Math.random() * 0.4 - 0.2) : 30,
            humidity: prev.humidity ? Math.min(100, Math.max(0, prev.humidity + (Math.random() * 2 - 1))) : 70,
            rain: Math.random() > 0.8 ? Math.random() * 5 : 0,
            condition: Math.random() > 0.8 ? 'Raining' : 'Cloudy',
            lastUpdate: nextTime.toLocaleTimeString('th-TH')
          }));

          return nextTime;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isSimulating]);

  const toggleSimulation = () => {
    if (!isSimulationMode) {
      setIsSimulationMode(true);
      setSimTime(new Date(time));
      setSimAlerts([]);
    }
    setIsSimulating(!isSimulating);
  };

  const resetSimulation = () => {
    setIsSimulating(false);
    setIsSimulationMode(false);
    setSimAlerts([]);
    void fetchRealWeatherData();
  };

  const displayTime = isSimulationMode ? simTime : time;

  const handleIModelAppInit = async () => {
    await TreeWidget.initialize(IModelApp.localization);
    await PropertyGridManager.initialize(IModelApp.localization);
    await MeasureTools.startup();
    await MapLayersUI.initialize({ localization: IModelApp.localization });
  };

  const getMenuClass = (menu: string) => {
    return activeMenu === menu
      ? "flex items-center px-3 py-3 text-sm font-medium rounded-md bg-border/50 text-accent w-full text-left transition-colors"
      : "flex items-center px-3 py-3 text-sm font-medium rounded-md text-text-muted hover:bg-border/50 hover:text-text-main w-full text-left transition-colors";
  };

  return (
    <div className={`flex h-screen w-screen bg-main text-text-main font-sans overflow-hidden ${theme}`}>
      {/* Left Sidebar */}
      <div className="w-64 bg-sidebar/90 backdrop-blur-md flex flex-col border-r border-border/50">
        <div className="p-6 border-b border-border/50">
          <h1 className="text-xl font-bold tracking-wide">DigitalTwin บางเทาแม่</h1>
          <div className="flex items-center mt-2 text-xs text-success">
            <div className="w-2 h-2 rounded-full bg-success mr-2"></div>
            SYSTEM ONLINE
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-4">
          <nav className="space-y-1 px-3">
            <button onClick={() => setActiveMenu('command-center')} className={getMenuClass('command-center')}>
              <LayoutDashboard className="mr-3 h-5 w-5" />
              Command Center
            </button>
            <button onClick={() => setActiveMenu('water-management')} className={getMenuClass('water-management')}>
              <Droplets className="mr-3 h-5 w-5" />
              Water Management
            </button>
            <button onClick={() => setActiveMenu('environment')} className={getMenuClass('environment')}>
              <Leaf className="mr-3 h-5 w-5" />
              Environment
            </button>
            <button onClick={() => setActiveMenu('surveillance')} className={getMenuClass('surveillance')}>
              <Camera className="mr-3 h-5 w-5" />
              Surveillance
            </button>
          </nav>

          <div className="mt-8 px-6">
            <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-4 flex items-center">
              <Camera className="mr-2 h-4 w-4" /> CCTV STATUS (16 UNITS)
            </h2>
            <div className="grid grid-cols-4 gap-2">
              {Array.from({ length: 16 }).map((_, i) => (
                <div key={i} className="aspect-square bg-success/20 rounded flex items-center justify-center text-xs text-success font-medium border border-success/30">
                  {i + 1}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-border/50">
          <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3 flex items-center">
            <Settings className="mr-2 h-4 w-4" /> THEME SELECT
          </h2>
          <div className="flex space-x-2 mb-6">
            <button 
              onClick={() => setTheme('theme-default')} 
              className={`w-10 h-6 bg-[#1B3A2B] rounded cursor-pointer transition-all ${theme === 'theme-default' ? 'ring-2 ring-white ring-offset-2 ring-offset-sidebar/90 backdrop-blur-md' : 'border border-gray-500 opacity-70 hover:opacity-100'}`}
              aria-label="Default Green Theme"
            ></button>
            <button 
              onClick={() => setTheme('theme-dark')} 
              className={`w-10 h-6 bg-[#525252] rounded cursor-pointer transition-all ${theme === 'theme-dark' ? 'ring-2 ring-white ring-offset-2 ring-offset-sidebar/90 backdrop-blur-md' : 'border border-gray-500 opacity-70 hover:opacity-100'}`}
              aria-label="Dark Theme"
            ></button>
            <button 
              onClick={() => setTheme('theme-light')} 
              className={`w-10 h-6 bg-[#F0EBE1] rounded cursor-pointer transition-all ${theme === 'theme-light' ? 'ring-2 ring-black ring-offset-2 ring-offset-sidebar/90 backdrop-blur-md' : 'border border-gray-500 opacity-70 hover:opacity-100'}`}
              aria-label="Light Theme"
            ></button>
          </div>

          <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3 flex items-center">
            <Settings className="mr-2 h-4 w-4" /> CONTROLS
          </h2>
          <div className="flex space-x-2">
            <button 
              onClick={toggleSimulation}
              className={`flex-1 hover:text-black py-2 px-4 rounded text-sm font-medium flex items-center justify-center transition-colors ${isSimulating ? 'bg-warning text-black' : 'bg-border/50 hover:bg-accent text-text-main'}`}
            >
              {isSimulating ? <Pause className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4" />} 
              {isSimulating ? 'PAUSE' : 'RESUME'}
            </button>
            <button 
              onClick={resetSimulation}
              className="bg-border/50 hover:bg-accent hover:text-black text-text-main p-2 rounded transition-colors"
              title="Reset to Live Data"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {/* Floating Alerts */}
        {simAlerts.length > 0 && (
          <div className="absolute top-24 right-6 z-50 flex flex-col gap-2 w-80 pointer-events-none">
            {simAlerts.map(alert => (
              <div key={alert.id} className={`p-3 rounded shadow-lg border-l-4 bg-panel/80 backdrop-blur-md flex flex-col gap-1 animate-in slide-in-from-right ${alert.type === 'danger' ? 'border-danger' : alert.type === 'warning' ? 'border-warning' : 'border-success'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertCircle className={`w-4 h-4 ${alert.type === 'danger' ? 'text-danger' : alert.type === 'warning' ? 'text-warning' : 'text-success'}`} />
                    <span className={`text-xs font-bold uppercase ${alert.type === 'danger' ? 'text-danger' : alert.type === 'warning' ? 'text-warning' : 'text-success'}`}>{alert.type} ALERT</span>
                  </div>
                  <span className="text-[10px] text-text-muted">{alert.time}</span>
                </div>
                <p className="text-sm text-text-main">{alert.message}</p>
              </div>
            ))}
          </div>
        )}

        {/* Header */}
        <header className="flex justify-between items-center p-6 border-b border-border/50">
          <div>
            <h2 className="text-lg font-bold tracking-wider uppercase flex items-center gap-3">
              {activeMenu === 'command-center' ? 'OVERVIEW' : activeMenu.replace('-', ' ')}
              {activeMenu === 'command-center' && !isSimulationMode && (
                <button 
                  onClick={handleManualRefresh}
                  className={`text-xs text-success border border-success/50 px-2 py-1 rounded flex items-center gap-1 hover:bg-success/10 transition-all cursor-pointer ${!isRefreshing ? 'animate-pulse' : ''}`}
                  title="Click to refresh data"
                >
                  {weather.temp !== null ? 'LIVE' : 'SYNCING'} <RefreshCw size={12} className={isRefreshing ? "animate-spin" : ""}/>
                </button>
              )}
              {isSimulationMode && (
                <div className="text-xs text-black bg-warning px-2 py-1 rounded flex items-center gap-1 font-bold animate-pulse">
                  <Play size={12} /> SIMULATION MODE (720x)
                </div>
              )}
            </h2>
            <div className="text-sm text-accent">{displayTime.toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} เวลา {displayTime.toLocaleTimeString('th-TH', { hour12: false })} น.</div>
          </div>
          <div className="flex space-x-4">
            <div className="flex items-center px-4 py-2 bg-accent/10 text-accent rounded-md border border-accent/30">
              <Wrench className="h-4 w-4 mr-2" />
              <div className="text-xs text-right">
                <div className="opacity-80">SYSTEM HEALTH</div>
                <div className="font-bold">SENSOR MAINTENANCE</div>
              </div>
            </div>
            <div className="flex items-center px-4 py-2 bg-panel/80 backdrop-blur-md rounded-md border border-border/50">
              <AlertCircle className={`h-4 w-4 mr-2 ${simAlerts.length > 0 ? 'text-danger animate-pulse' : 'text-text-muted'}`} />
              <div className="text-xs text-right">
                <div className={simAlerts.length > 0 ? 'text-danger' : 'text-text-muted'}>ISSUES</div>
                <div className={`font-bold ${simAlerts.length > 0 ? 'text-danger' : 'text-text-main'}`}>{2 + simAlerts.length}</div>
              </div>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-6 flex flex-col space-y-6">
          {activeMenu === 'command-center' && (
            <>
              {/* Top Cards */}
              <div className="grid grid-cols-4 gap-4">
                <div className="bg-panel/80 backdrop-blur-md rounded-lg p-4 border border-border/50 flex flex-col justify-between">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-xs text-text-muted uppercase tracking-wider">AIR QUALITY (KRABI)</h3>
                    <Wind className="h-4 w-4 text-accent" />
                  </div>
                  <div className="flex items-end space-x-3">
                    <span className={`text-4xl font-bold ${weather.aqi !== null && weather.aqi > 100 ? 'text-danger' : weather.aqi !== null && weather.aqi > 50 ? 'text-warning' : 'text-success'}`}>
                      {weather.aqi !== null ? weather.aqi.toFixed(2) : '--'}
                    </span>
                    <div className="pb-1">
                      <div className={`text-white text-[10px] px-2 py-0.5 rounded font-bold uppercase ${weather.aqi !== null && weather.aqi > 100 ? 'bg-danger' : weather.aqi !== null && weather.aqi > 50 ? 'bg-warning' : 'bg-success'}`}>
                        {weather.aqi !== null && weather.aqi > 100 ? 'Unhealthy' : weather.aqi !== null && weather.aqi > 50 ? 'Moderate' : 'Good'}
                      </div>
                      <div className="text-xs text-text-muted mt-1">PM2.5: {weather.pm25 !== null ? weather.pm25.toFixed(2) : '--'} µg/m³</div>
                    </div>
                  </div>
                </div>

                <div className="bg-panel/80 backdrop-blur-md rounded-lg p-4 border border-border/50 flex flex-col justify-between">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-xs text-text-muted uppercase tracking-wider">WEATHER (KRABI)</h3>
                    <Sun className="h-4 w-4 text-accent" />
                  </div>
                  <div className="flex items-end space-x-3">
                    <span className="text-4xl font-bold">{weather.temp !== null ? weather.temp.toFixed(2) : '--'}°</span>
                    <div className="pb-1">
                      <div className="text-sm font-bold">{weather.condition}</div>
                      <div className="text-xs text-text-muted">Feels like {weather.temp !== null ? (weather.temp + 2).toFixed(2) : '--'}°</div>
                    </div>
                  </div>
                </div>

                <div className="bg-panel/80 backdrop-blur-md rounded-lg p-4 border border-border/50 flex flex-col justify-between">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-xs text-text-muted uppercase tracking-wider">RAINFALL (KRABI)</h3>
                    <CloudRain className="h-4 w-4 text-text-muted" />
                  </div>
                  <div className="flex justify-between items-end">
                    <div className="text-xs text-text-muted pb-1">Current (1hr)</div>
                    <div className="flex items-baseline space-x-1">
                      <span className="text-4xl font-bold">{weather.rain !== null ? weather.rain.toFixed(2) : '--'}</span>
                      <span className="text-sm text-text-muted">mm</span>
                    </div>
                  </div>
                </div>

                <div className="bg-panel/80 backdrop-blur-md rounded-lg p-4 border border-border/50 flex flex-col justify-between">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-xs text-text-muted uppercase tracking-wider">WIND & FORECAST</h3>
                    <Navigation className="h-4 w-4 text-accent" style={{transform: `rotate(${weather.windDir}deg)`}} />
                  </div>
                  <div className="flex space-x-2">
                    <div className="flex-1 bg-main rounded p-2 text-center">
                      <div className="text-[10px] text-text-muted mb-1">Wind Speed</div>
                      <div className="text-xl font-bold">{weather.windSpeed !== null ? weather.windSpeed.toFixed(2) : '--'}</div>
                    </div>
                    <div className="flex-1 bg-main rounded p-2 text-center">
                      <div className="text-[10px] text-text-muted mb-1">Chance Rain</div>
                      <div className="text-xl font-bold">{weather.chanceRain !== null ? `${weather.chanceRain.toFixed(2)}%` : '--'}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Middle Area */}
              <div className="flex-1 flex space-x-6 min-h-[400px]">
                {/* Digital Twin Map Area */}
                <div className="flex-1 bg-panel/80 backdrop-blur-md rounded-lg border border-border/50 flex flex-col overflow-hidden relative">
                  <div className="p-4 border-b border-border/50 flex items-center z-10 bg-panel/80 backdrop-blur-md">
                    <Map className="h-5 w-5 mr-2 text-accent" />
                    <h3 className="font-bold tracking-wide">DIGITAL TWIN SIMULATION ({time.toLocaleTimeString('th-TH', { hour12: false })} น.)</h3>
                  </div>
                  
                  {/* iTwin Viewer Container */}
                  <div className="flex-1 relative overflow-hidden bg-black/10 flex items-center justify-center">
                     <div className="text-center p-8 bg-panel/80 backdrop-blur-md rounded-xl border border-border/50">
                        <Map className="w-16 h-16 text-accent mx-auto mb-4 opacity-50" />
                        <h2 className="text-xl font-bold text-text-main mb-2">3D Map View Disabled</h2>
                        <p className="text-text-muted text-sm max-w-md">The iTwin 3D Viewer has been temporarily bypassed so you can explore the rest of the dashboard UI.</p>
                     </div>
                  </div>
                  
                  {/* Bottom Info Panel */}
                  <div className="bg-main border-t border-border/50 p-4 flex justify-between items-center rounded-b-lg">
                    <div>
                      <h4 className="flex items-center text-sm font-bold text-accent mb-2">
                        <Map className="h-4 w-4 mr-2" /> GIS DIGITAL TWIN
                      </h4>
                      <div className="flex space-x-6 text-xs">
                        <div className="flex items-center"><span className="text-text-muted mr-2">Location:</span> <span className="font-medium">Khlong Bang Thao Mae</span></div>
                        <div className="flex items-center"><span className="text-text-muted mr-2">Base Map:</span> <span className="font-medium">Google Satellite</span></div>
                        <div className="flex items-center text-text-muted">
                          <span className="mr-3"><Navigation className="inline h-3 w-3 mr-1" />8.604 N</span>
                          <span><Navigation className="inline h-3 w-3 mr-1" />98.718 E</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <div className="text-[10px] text-text-muted mb-1 text-left">ZONE STATUS</div>
                      <div className="bg-warning/20 text-warning px-3 py-1.5 rounded flex items-center font-bold text-xs border border-warning/30">
                        <div className="w-2 h-2 rounded-full bg-warning mr-2"></div>
                        <span className="mr-3">WARNING</span>
                        <span className="text-text-main font-normal">เฝ้าระวังระดับน้ำ</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Sidebar - Station Status */}
                <div className="w-72 bg-panel/80 backdrop-blur-md rounded-lg border border-border/50 flex flex-col">
                  <div className="p-4 border-b border-border/50 flex items-center">
                    <LayoutDashboard className="h-5 w-5 mr-2 text-accent" />
                    <h3 className="font-bold tracking-wide">STATION STATUS</h3>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    
                    <div className="bg-main rounded p-3 border border-border/50 flex justify-between items-center">
                      <div>
                        <div className="text-xs text-text-muted mb-1">WL01</div>
                        <div className="font-bold text-lg">85.68 m.</div>
                        <div className="text-[10px] text-success font-bold mt-1">NORMAL</div>
                      </div>
                      <div className="w-3 h-3 rounded-full bg-success"></div>
                    </div>

                    <div className="bg-main rounded p-3 border border-border/50 flex justify-between items-center">
                      <div>
                        <div className="text-xs text-text-muted mb-1">cam-01</div>
                        <div className="font-bold text-lg">Online</div>
                        <div className="text-[10px] text-success font-bold mt-1">ONLINE</div>
                      </div>
                      <div className="w-3 h-3 rounded-full bg-success"></div>
                    </div>

                    <div className="bg-main rounded p-3 border border-border/50 flex justify-between items-center">
                      <div>
                        <div className="text-xs text-text-muted mb-1">cam-14</div>
                        <div className="font-bold text-lg">Online</div>
                        <div className="text-[10px] text-success font-bold mt-1">ONLINE</div>
                      </div>
                      <div className="w-3 h-3 rounded-full bg-success"></div>
                    </div>

                    <div className="bg-main rounded p-3 border border-border/50 flex justify-between items-center">
                      <div>
                        <div className="text-xs text-text-muted mb-1">cam-15</div>
                        <div className="font-bold text-lg">Online</div>
                        <div className="text-[10px] text-success font-bold mt-1">ONLINE</div>
                      </div>
                      <div className="w-3 h-3 rounded-full bg-success"></div>
                    </div>

                    <div className="bg-main rounded p-3 border border-warning/50 flex justify-between items-center">
                      <div>
                        <div className="text-xs text-text-muted mb-1">WL03</div>
                        <div className="font-bold text-lg text-warning">63.95 m.</div>
                        <div className="text-[10px] text-warning font-bold mt-1">WARNING</div>
                      </div>
                      <div className="w-3 h-3 rounded-full bg-warning"></div>
                    </div>

                  </div>
                </div>
              </div>
            </>
          )}

          {activeMenu === 'water-management' && (
            <div className="flex-1 flex flex-col space-y-4">
              <div className="grid grid-cols-2 gap-6 mb-2">
                {/* Flow Meter Left */}
                <div className="bg-panel/80 backdrop-blur-md rounded-lg p-4 border border-border/50 h-48 flex flex-col">
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-2 text-text-muted text-xs font-bold tracking-wider">
                      <div className="p-1.5 rounded-full bg-border/50"><Gauge className="w-4 h-4 text-accent" /></div>
                      FLOW METER (LEFT) (FM01)
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-bold text-text-main">{flowMeterData[flowMeterData.length - 1].fm01.toFixed(2)}</span>
                      <span className="text-xs text-text-muted">m³/hr</span>
                    </div>
                  </div>
                  <div className="flex-1 -mx-4 -mb-4 mt-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={flowMeterData} margin={{ top: 5, right: 0, bottom: 0, left: 0 }}>
                        <defs>
                          <linearGradient id="colorFm01" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="var(--color-accent)" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="var(--color-accent)" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="time" hide />
                        <Tooltip content={<CustomTooltip name="Flow Meter (Left) (FM01)" unit="m³/hr" />} cursor={{ stroke: 'var(--color-text-muted)', strokeWidth: 1, strokeDasharray: '3 3' }} />
                        <Area type="monotone" dataKey="fm01" stroke="var(--color-accent)" strokeWidth={2} fillOpacity={1} fill="url(#colorFm01)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Flow Meter Right */}
                <div className="bg-panel/80 backdrop-blur-md rounded-lg p-4 border border-border/50 h-48 flex flex-col">
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-2 text-text-muted text-xs font-bold tracking-wider">
                      <div className="p-1.5 rounded-full bg-border/50"><Gauge className="w-4 h-4 text-accent" /></div>
                      FLOW METER (RIGHT) (FM02)
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-bold text-text-main">{flowMeterData[flowMeterData.length - 1].fm02.toFixed(2)}</span>
                      <span className="text-xs text-text-muted">m³/hr</span>
                    </div>
                  </div>
                  <div className="flex-1 -mx-4 -mb-4 mt-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={flowMeterData} margin={{ top: 5, right: 0, bottom: 0, left: 0 }}>
                        <defs>
                          <linearGradient id="colorFm02" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="var(--color-accent)" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="var(--color-accent)" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="time" hide />
                        <Tooltip content={<CustomTooltip name="Flow Meter (Right) (FM02)" unit="m³/hr" />} cursor={{ stroke: 'var(--color-text-muted)', strokeWidth: 1, strokeDasharray: '3 3' }} />
                        <Area type="monotone" dataKey="fm02" stroke="var(--color-accent)" strokeWidth={2} fillOpacity={1} fill="url(#colorFm02)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              <div className="mb-2">
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-1.5 rounded bg-accent"><Droplets className="w-5 h-5 text-white" /></div>
                  <div>
                    <h3 className="text-lg font-bold text-text-main">Water Quality Monitoring</h3>
                    <p className="text-[10px] text-text-muted">คุณภาพน้ำอ่างเก็บน้ำบางเท่าแม่</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-6">
                  {/* DO */}
                  <div className="bg-panel/80 backdrop-blur-md rounded-lg p-4 border border-border/50 h-40 flex flex-col">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded bg-border/50"><Waves className="w-4 h-4 text-text-muted" /></div>
                        <div>
                          <div className="text-xs font-bold text-text-muted tracking-wider">DISSOLVED OXYGEN (DO)</div>
                          <div className="text-[10px] text-text-muted">Optimal</div>
                        </div>
                      </div>
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-bold text-text-main">{waterQualityData[waterQualityData.length - 1].do.toFixed(2)}</span>
                        <span className="text-[10px] text-text-muted">mg/L</span>
                      </div>
                    </div>
                    <div className="flex-1 -mx-4 -mb-4 mt-2">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={waterQualityData} margin={{ top: 5, right: 0, bottom: 0, left: 0 }}>
                          <defs>
                            <linearGradient id="colorDo" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <XAxis dataKey="time" hide />
                          <Tooltip content={<CustomTooltip name="Dissolved Oxygen (DO)" unit="mg/L" />} cursor={{ stroke: 'var(--color-text-muted)', strokeWidth: 1, strokeDasharray: '3 3' }} />
                          <Area type="monotone" dataKey="do" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorDo)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Turbidity */}
                  <div className="bg-panel/80 backdrop-blur-md rounded-lg p-4 border border-border/50 h-40 flex flex-col">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded bg-border/50"><CloudFog className="w-4 h-4 text-text-muted" /></div>
                        <div>
                          <div className="text-xs font-bold text-text-muted tracking-wider">TURBIDITY</div>
                          <div className="text-[10px] text-text-muted">Clear</div>
                        </div>
                      </div>
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-bold text-text-main">{waterQualityData[waterQualityData.length - 1].turbidity.toFixed(2)}</span>
                        <span className="text-[10px] text-text-muted">NTU</span>
                      </div>
                    </div>
                    <div className="flex-1 -mx-4 -mb-4 mt-2">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={waterQualityData} margin={{ top: 5, right: 0, bottom: 0, left: 0 }}>
                          <defs>
                            <linearGradient id="colorTurbidity" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#8b5a2b" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="#8b5a2b" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <XAxis dataKey="time" hide />
                          <Tooltip content={<CustomTooltip name="Turbidity" unit="NTU" />} cursor={{ stroke: 'var(--color-text-muted)', strokeWidth: 1, strokeDasharray: '3 3' }} />
                          <Area type="monotone" dataKey="turbidity" stroke="#8b5a2b" strokeWidth={2} fillOpacity={1} fill="url(#colorTurbidity)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* PH Level */}
                  <div className="bg-panel/80 backdrop-blur-md rounded-lg p-4 border border-border/50 h-40 flex flex-col">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded bg-border/50"><Gauge className="w-4 h-4 text-text-muted" /></div>
                        <div>
                          <div className="text-xs font-bold text-text-muted tracking-wider">PH LEVEL</div>
                          <div className="text-[10px] text-text-muted">Neutral</div>
                        </div>
                      </div>
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-bold text-text-main">{waterQualityData[waterQualityData.length - 1].ph.toFixed(2)}</span>
                      </div>
                    </div>
                    <div className="flex-1 -mx-4 -mb-4 mt-2">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={waterQualityData} margin={{ top: 5, right: 0, bottom: 0, left: 0 }}>
                          <defs>
                            <linearGradient id="colorPh" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <XAxis dataKey="time" hide />
                          <Tooltip content={<CustomTooltip name="pH Level" unit="" />} cursor={{ stroke: 'var(--color-text-muted)', strokeWidth: 1, strokeDasharray: '3 3' }} />
                          <Area type="monotone" dataKey="ph" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorPh)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-end mb-2 mt-4">
                 <div>
                    <h2 className="text-2xl font-bold text-text-main">Water Station Profiles</h2>
                    <p className="text-xs text-text-muted">Cross-section analysis of monitoring points</p>
                 </div>
                 <div className="text-xs text-text-muted text-right flex items-center gap-2">
                    <span className="inline-block w-2 h-2 rounded-full bg-danger"></span>Critical
                    <span className="inline-block w-2 h-2 rounded-full bg-warning"></span>Warning
                    <span className="inline-block w-2 h-2 rounded-full bg-success"></span>Normal
                 </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 pb-6">
                {waterStations.map((st) => (
                  <WaterProfile3D key={st.id} station={st} />
                ))}
              </div>
            </div>
          )}

          {activeMenu === 'surveillance' && (
            <div className="flex-1 flex flex-col space-y-4">
              <div className="flex justify-between items-center mb-2">
                <div>
                  <h2 className="text-2xl font-bold text-text-main">Surveillance Replay</h2>
                  <p className="text-xs text-text-muted">Live feeds and simulated playback</p>
                </div>
                <div className="flex items-center gap-2 text-text-muted text-sm bg-black/30 px-3 py-1 rounded">
                  <div className="w-2 h-2 rounded-full bg-danger animate-pulse"></div>
                  REC: {time.toLocaleTimeString('th-TH', { hour12: false })} น.
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 overflow-y-auto pb-4">
                {Array.from({ length: 16 }).map((_, i) => {
                  const cam = i + 1;
                  return (
                    <div key={cam} className="bg-black rounded-lg overflow-hidden relative group aspect-video border border-border/50">
                      <div className="absolute inset-0 flex items-center justify-center bg-main relative">
                        <span className="text-text-muted text-xs opacity-50">CCTV STREAM {cam}</span>
                      </div>
                      <div className="absolute top-2 left-2 bg-black/50 px-2 py-1 rounded text-xs text-white flex items-center gap-2 z-10 pointer-events-none">
                          <span className="w-2 h-2 rounded-full bg-success animate-pulse"></span> LIVE <span>CAM-{cam.toString().padStart(2, '0')}</span>
                      </div>
                      <div className="absolute bottom-2 left-2 text-[10px] text-white/80 font-mono z-10 pointer-events-none">{time.toLocaleString('th-TH', { hour12: false })} น.</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeMenu === 'environment' && (
            <div className="flex-1 flex flex-col space-y-4">
              <div className="flex justify-between items-center mb-2">
                <div>
                  <h2 className="text-2xl font-bold text-text-main">Environment Monitoring</h2>
                  <p className="text-xs text-text-muted">Air quality, weather, and environmental sensors</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div className="bg-panel/80 backdrop-blur-md rounded-lg p-6 border border-border/50 md:col-span-1">
                  <h3 className="text-lg font-bold mb-4 flex items-center text-accent">
                    <Wind className="mr-2" /> Air Quality Index (AQI)
                  </h3>
                  <div className="flex items-center justify-center py-4">
                    <div className="relative w-40 h-40 flex items-center justify-center rounded-full border-8 border-success">
                      <div className="text-center">
                        <div className="text-4xl font-bold text-text-main">{weather.aqi !== null ? weather.aqi.toFixed(2) : '--'}</div>
                        <div className="text-xs text-text-muted mt-1">US AQI</div>
                        <div className="text-[10px] font-bold text-success mt-2 bg-success/20 px-2 py-1 rounded">GOOD</div>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div className="bg-main p-3 rounded border border-border/50">
                      <div className="text-xs text-text-muted">PM2.5</div>
                      <div className="text-xl font-bold text-text-main">{weather.pm25 !== null ? weather.pm25.toFixed(2) : '--'} <span className="text-xs font-normal">µg/m³</span></div>
                    </div>
                    <div className="bg-main p-3 rounded border border-border/50">
                      <div className="text-xs text-text-muted">PM10</div>
                      <div className="text-xl font-bold text-text-main">{weather.pm10 !== null ? weather.pm10.toFixed(2) : '--'} <span className="text-xs font-normal">µg/m³</span></div>
                    </div>
                  </div>
                </div>

                <div className="bg-panel/80 backdrop-blur-md rounded-lg p-6 border border-border/50 md:col-span-2 flex flex-col">
                  <h3 className="text-lg font-bold mb-4 flex items-center text-accent">
                    <Wind className="mr-2" /> 7-Day Air Quality Trend
                  </h3>
                  <div className="flex-1 min-h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={aqiHistoryData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorAqi" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="var(--color-success)" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="var(--color-success)" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                        <XAxis dataKey="day" stroke="var(--color-text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis stroke="var(--color-text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                        <Tooltip content={<CustomTooltip unit="" />} cursor={{ stroke: 'var(--color-text-muted)', strokeWidth: 1, strokeDasharray: '3 3' }} />
                        <Area type="monotone" dataKey="aqi" stroke="var(--color-success)" fillOpacity={1} fill="url(#colorAqi)" name="AQI" />
                        <Area type="monotone" dataKey="pm25" stroke="var(--color-accent)" fillOpacity={0} name="PM2.5" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-panel/80 backdrop-blur-md rounded-lg p-6 border border-border/50 md:col-span-3">
                  <h3 className="text-lg font-bold mb-4 flex items-center text-accent">
                    <Sun className="mr-2" /> Current Weather Conditions
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div className="bg-main p-4 rounded border border-border/50 flex flex-col items-center justify-center text-center">
                      <Sun className="w-6 h-6 mb-2 text-warning" />
                      <div className="text-xs text-text-muted mb-1">Temperature</div>
                      <div className="font-bold text-xl text-text-main">{weather.temp !== null ? weather.temp.toFixed(2) : '--'} °C</div>
                    </div>
                    <div className="bg-main p-4 rounded border border-border/50 flex flex-col items-center justify-center text-center">
                      <Droplets className="w-6 h-6 mb-2 text-accent" />
                      <div className="text-xs text-text-muted mb-1">Humidity</div>
                      <div className="font-bold text-xl text-text-main">{weather.humidity !== null ? weather.humidity.toFixed(2) : '--'} %</div>
                    </div>
                    <div className="bg-main p-4 rounded border border-border/50 flex flex-col items-center justify-center text-center">
                      <Navigation className="w-6 h-6 mb-2 text-text-muted" />
                      <div className="text-xs text-text-muted mb-1">Wind Speed</div>
                      <div className="font-bold text-xl text-text-main">{weather.windSpeed !== null ? weather.windSpeed.toFixed(2) : '--'} km/h</div>
                    </div>
                    <div className="bg-main p-4 rounded border border-border/50 flex flex-col items-center justify-center text-center">
                      <CloudRain className="w-6 h-6 mb-2 text-accent" />
                      <div className="text-xs text-text-muted mb-1">Rainfall (1h)</div>
                      <div className="font-bold text-xl text-text-main">{weather.rain !== null ? weather.rain.toFixed(2) : '--'} mm</div>
                    </div>
                    <div className="bg-main p-4 rounded border border-border/50 flex flex-col items-center justify-center text-center">
                      <Sun className="w-6 h-6 mb-2 text-accent" />
                      <div className="text-xs text-text-muted mb-1">UV Index</div>
                      <div className="font-bold text-xl text-text-main">{weather.uv !== null ? weather.uv.toFixed(2) : '--'}</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-6">
                {/* AQI */}
                <SensorCard title="AQI (US INDEX)" subtitle={weather.aqi !== null && weather.aqi > 100 ? 'Unhealthy' : weather.aqi !== null && weather.aqi > 50 ? 'Moderate' : 'Good'} value={weather.aqi} unit="" icon={<Wind className="w-4 h-4" />} data={historyData.aqi} color="var(--color-success)" gradient="colorAqi" />
                {/* PM2.5 */}
                <SensorCard title="PM2.5" value={weather.pm25} unit="µg/m³" icon={<CloudFog className="w-4 h-4" />} data={historyData.pm25} color="var(--color-danger)" gradient="colorPm25" />
                {/* PM10 */}
                <SensorCard title="PM10" value={weather.pm10} unit="µg/m³" icon={<CloudFog className="w-4 h-4" />} data={historyData.pm10} color="var(--color-warning)" gradient="colorPm10" />
                {/* UV INDEX */}
                <SensorCard title="UV INDEX" value={weather.uv} unit="" icon={<Sun className="w-4 h-4" />} data={historyData.uv} color="var(--color-danger)" gradient="colorUv" />
                {/* TEMPERATURE */}
                <SensorCard title="TEMPERATURE" value={weather.temp} unit="°C" icon={<Thermometer className="w-4 h-4" />} data={historyData.temp} color="var(--color-text-main)" gradient="colorTemp" />
                {/* HUMIDITY */}
                <SensorCard title="HUMIDITY" value={weather.humidity} unit="%" icon={<Droplets className="w-4 h-4" />} data={historyData.humidity} color="var(--color-accent)" gradient="colorHumid" />
                {/* ATM. PRESSURE */}
                <SensorCard title="ATM. PRESSURE" value={weather.pressure} unit="hPa" icon={<Gauge className="w-4 h-4" />} data={historyData.pressure} color="var(--color-success)" gradient="colorPress" />
                {/* HOURLY RAINFALL */}
                <SensorCard title="HOURLY RAINFALL" value={weather.rain} unit="mm" icon={<CloudRain className="w-4 h-4" />} data={historyData.rain} color="var(--color-text-muted)" gradient="colorRain" />
                {/* WIND SPEED */}
                <SensorCard title="WIND SPEED" value={weather.windSpeed} unit="km/h" icon={<Navigation className="w-4 h-4" />} data={historyData.wind} color="var(--color-text-main)" gradient="colorWind" />
                
                {/* WIND ROSE */}
                <div className="bg-panel/80 backdrop-blur-md rounded-lg p-4 border border-border/50 flex flex-col h-64">
                   <div className="flex items-center text-text-muted mb-2">
                     <div className="bg-main p-1.5 rounded mr-2">
                       <Compass className="w-4 h-4 text-danger" />
                     </div>
                     <div>
                       <h3 className="text-xs font-bold uppercase tracking-wider text-text-main">WIND ROSE (24H)</h3>
                       <div className="text-[10px]">24H Distribution</div>
                     </div>
                   </div>
                   <div className="flex-1 relative">
                     <ResponsiveContainer width="100%" height="100%">
                        <RadarChart cx="50%" cy="50%" outerRadius="70%" data={windRoseData}>
                          <PolarGrid stroke="var(--color-border)" />
                          <PolarAngleAxis dataKey="direction" tick={{ fill: 'var(--color-text-muted)', fontSize: 10 }} />
                          <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                          <Radar name="Wind" dataKey="value" stroke="var(--color-danger)" fill="var(--color-danger)" fillOpacity={0.2} />
                        </RadarChart>
                     </ResponsiveContainer>
                   </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
