
// ==========================================
// 摄影技术数据库 (Cinematography Domain) - ULTRA EXPANDED
// 核心: 窥视、框式构图、物理介质、压抑的体态
// ==========================================

export interface CompositionStrategy {
    id: string;
    label: string;
    prompt: string; 
    safety: string; 
}

// 1. 构图策略库 (Compositions)
export const COMPOSITION_STRATEGIES: CompositionStrategy[] = [
    {
        id: "frame_in_frame",
        label: "框中框",
        prompt: "Shot through a doorway, window, or mirror. Creating a frame within a frame. Subject feels trapped or observed.",
        safety: "Ensure subject is visible."
    },
    {
        id: "reflection_mirror",
        label: "多重反射",
        prompt: "Shooting into a mirror or glass surface. Capturing the reflection and the real world simultaneously. Layered image.",
        safety: "Focus on reflection."
    },
    {
        id: "dutch_angle",
        label: "荷兰倾斜",
        prompt: "Camera tilted 45 degrees. Creating uneasiness and tension. Dynamic composition.",
        safety: "Intentional tilt."
    },
    {
        id: "extreme_close_up",
        label: "极端特写",
        prompt: "Macro shot of a specific detail (eye, lips, hand, object). Abstracting the subject. Texture focus.",
        safety: "Crop aesthetically."
    },
    {
        id: "extreme_long_shot",
        label: "大远景",
        prompt: "Subject is tiny in the frame, dominated by the environment/architecture. Sense of isolation.",
        safety: "Subject recognizable."
    },
    {
        id: "low_angle",
        label: "仰视视角",
        prompt: "Camera placed low, looking up at subject. Subject looks powerful or distant.",
        safety: "Check skirt angles."
    },
    {
        id: "high_angle",
        label: "上帝/监控视角",
        prompt: "Camera looking down from high above (CCTV style). Subject looks vulnerable.",
        safety: "Natural pose."
    },
    {
        id: "over_shoulder",
        label: "过肩/窥视",
        prompt: "Shot from behind someone or something. Voyeuristic feeling. Blurred foreground.",
        safety: "Obscure partially."
    },
    {
        id: "center_symmetry",
        label: "韦斯安德森式对称",
        prompt: "Perfectly centered subject, symmetrical background. Artificial and staged look.",
        safety: "Balance."
    },
    {
        id: "negative_space",
        label: "大量留白",
        prompt: "Subject placed in corner, vast empty space (sky, wall, darkness) fills the rest.",
        safety: "Texture in empty space."
    },
    {
        id: "motion_blur",
        label: "动态模糊",
        prompt: "Slow shutter speed. Subject or background is blurred/streaky. Sense of movement and chaos.",
        safety: "Artistic blur."
    },
    {
        id: "shallow_focus",
        label: "浅景深",
        prompt: "f/1.2 aperture. Eyes sharp, ears blurred. Dreamy bokeh background.",
        safety: "Focus on eyes."
    }
];

// 2. 景深层次 (Depth Layers)
export const DEPTH_LAYERS = [
    "Foreground: Blurred wire fence. Middle: Sharp subject. Background: City lights.",
    "Foreground: Rain on glass. Middle: Subject silhouette. Background: Street.",
    "Foreground: Smoke. Middle: Subject. Background: Textured wall.",
    "Foreground: Out of focus shoulder. Middle: Face. Background: Dark void.",
    "Foreground: Flowers/Leaves. Middle: Subject. Background: Sunlight.",
    "Foreground: Nothing. Middle: Sharp subject. Background: Infinite black (Flash).",
    "Foreground: Reflection. Middle: Glass. Background: Interior.",
    "Flat Lay: No depth, everything on one plane."
];

// 3. 胶片模拟 (Film Stocks)
export const ANALOG_STOCKS = [
    { content: "Kodak Portra 400 (Warm, fine grain)", tags: ["warm", "portrait"] },
    { content: "Cinestill 800T (Tungsten, Halation)", tags: ["night", "neon"] },
    { content: "Ilford HP5 (High contrast B&W)", tags: ["bw", "gritty"] },
    { content: "Fujifilm Pro 400H (Green/Pastel)", tags: ["soft", "cold"] },
    { content: "Kodak Gold 200 (Nostalgic yellow)", tags: ["vintage", "summer"] },
    { content: "Fujifilm Superia (Magenta tint)", tags: ["consumer", "cheap"] },
    { content: "LomoChrome Purple (Surreal)", tags: ["art", "purple"] },
    { content: "Expired Film (Color shifts, unpredictable)", tags: ["grunge", "random"] },
    { content: "Polaroid 600 (Soft, square)", tags: ["instant", "soft"] },
    { content: "Wet Plate Collodion (Ancient, artifacts)", tags: ["antique", "texture"] }
];

// 4. 镜头光学 (Optics)
export const OPTICS = [
    { content: "35mm f/1.4 (Classic Documentary)", tags: ["street", "real"] },
    { content: "50mm f/1.8 (Nifty Fifty)", tags: ["standard", "portrait"] },
    { content: "85mm f/1.2 (Creamy Bokeh)", tags: ["beauty", "soft"] },
    { content: "28mm Wide (Distorted, Point & Shoot)", tags: ["raw", "close"] },
    { content: "Helios 44-2 (Swirly Bokeh)", tags: ["dreamy", "art"] },
    { content: "Plastic Toy Lens (Vignette, Soft)", tags: ["lomo", "cheap"] },
    { content: "Anamorphic (Cinematic Flare, Oval Bokeh)", tags: ["movie", "wide"] },
    { content: "Fish Eye (Extreme Distortion)", tags: ["90s", "music"] }
];

// 5. 姿态库 (Poses) - 中式/东亚特化
export const POSES = {
    // A. 压抑与内收 (Restrained)
    RESTAINED: [
        "Sitting with knees pulled to chest (hugging knees).",
        "Hunching shoulders, looking down.",
        "Arms crossed tightly across chest.",
        "Hiding face in hands/palms.",
        "Standing stiffly, hands by sides (School style).",
        "Curled up in a fetal position.",
        "Sitting on hands.",
        "Looking over shoulder, body turned away."
    ],
    // B. 市井与松弛 (Casual/Street)
    CASUAL: [
        "Asian Squat (heels on ground).",
        "Leaning against a wall with one foot up.",
        "Sitting on a plastic stool, legs spread.",
        "Slumping in a chair, head back.",
        "Eating with chopsticks, bowl to mouth.",
        "Smoking pose, hand near mouth.",
        "Fixing shoe/tying lace.",
        "Stretching arms lazily."
    ],
    // C. 亲密与接触 (Intimate)
    INTIMATE: [
        "Head resting on another's shoulder.",
        "Holding hands, fingers interlocked.",
        "Brushing hair out of face.",
        "Whispering in ear.",
        "Leaning forehead against glass/wall.",
        "Touching own neck/collarbone.",
        "Playing with own hair.",
        "Biting finger/nail."
    ],
    // D. 动态与抓拍 (Dynamic)
    DYNAMIC: [
        "Walking away, motion blur.",
        "Turning head suddenly (hair whip).",
        "Running towards camera.",
        "Jumping mid-air.",
        "Laughing, head thrown back.",
        "Shielding face from light/camera.",
        "Reaching out hand towards lens."
    ],
    // E. 情绪化 (Emotional)
    EMOTIONAL: [
        "Wiping tears.",
        "Staring blankly (dead eyes).",
        "Screaming (silent or loud).",
        "Covering ears.",
        "Biting lip (anxiety).",
        "Clenching fists.",
        "Touching mirror reflection."
    ]
};

export const CINEMATOGRAPHY = {
    STRATEGIES: COMPOSITION_STRATEGIES,
    DEPTH_LAYERS,
    ANALOG_STOCKS,
    OPTICS,
    POSES,
    TENSION_SOURCES: OPTICS
};
