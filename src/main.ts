import "./style.css";
import { SceneManager } from "./scene/SceneManager";

const canvas = document.getElementById("three-canvas") as HTMLCanvasElement;
const scene = new SceneManager(canvas);
