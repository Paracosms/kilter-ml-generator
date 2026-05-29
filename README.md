# Kilterboard Problem Generator
## Generate a Kilter problem at any grade and angle you want! 
#### (no guarantee it'll be good!)

![Demo.gif](assets/Demo.gif)

## Summary
The Kilterboard Problem Generator works in 2 phases: generation and evaluation.
<br>
The generation phase creates a candidate problem using statistical distributions from a public dataset.
<br>
The evaluation phase is split into two parts: a machine learning model that predicts difficulty, 
and a deterministic model that scores the climb on how realistic it is.
<br>
The board visualization then updates in realtime as iterations of the generator run, 
keeping the best scoring candidate on screen.

## Dataset Statistics 
### Dataset Credit: [Vilin97/KilterBoard](https://huggingface.co/datasets/Vilin97/KilterBoard)

![Visualizations.png](assets/Visualizations.png)

## Compile Instructions
```bash
cd web
npm install
npm run dev
```
