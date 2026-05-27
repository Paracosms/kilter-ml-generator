# Generator Module

This folder is for the statistical generator to create candidates.

## Usage

```ts
import { generateCandidate } from "./generateCandidate";

const candidate = generateCandidate({ grade: "v4" });
```

## Example Form
```json
 { 
  "climb": 
  [ 
      { "placementId": 1149, "roleId": 12 },
      { "placementId": 1179, "roleId": 13 },
      { "placementId": 1252, "roleId": 13 },
      { "placementId": 1392, "roleId": 14 } 
  ],
  "grade": "v4",
  "modifier": "base",
  "targetDifficulty": 16.2,
  "sampledAngle": 40,
  "sampledRoleCounts": 
  {
    "start": 1,
    "regular": 2,
    "foot": 0,
    "finish": 1
  }
}

```

## Test
```bash
npm run sanity:Generator
```

