import { action } from "mobx";
import { observer } from "mobx-react-lite";
import { AnyControl, Control, EndControl, Path, Vector } from "../core/Path";
import Konva from "konva";
import { Circle, Line } from "react-konva";
import { Portal } from "react-konva-utils";
import { useState } from "react";
import { SegmentElementProps } from "./SegmentElement";
import { DragControls, RemovePathsAndEndControls, UpdatePathTreeItems } from "../core/Command";
import { getAppStores } from "../core/MainApp";
import { boundHeading, fromHeadingInDegreeToAngleInRadian, toHeading } from "../core/Calculation";
import { MagnetReference, magnet } from "../core/Magnet";

export interface ControlElementProps extends SegmentElementProps {
  cp: AnyControl;
  isGrabAndMove: boolean;
}

function getFollowersAndRemaining(
  paths: Path[],
  target: AnyControl,
  selected: string[],
  includeControl: boolean
): [AnyControl[], AnyControl[]] {
  const followers: AnyControl[] = [];
  const remaining: AnyControl[] = [];
  for (let path of paths) {
    for (let control of path.controls) {
      if (control === target) continue;
      if (control.visible === false || path.visible === false) continue;
      if (
        (!(control instanceof EndControl) && !includeControl) ||
        !selected.includes(control.uid) ||
        control.lock ||
        path.lock
      ) {
        remaining.push(control);
      } else {
        followers.push(control);
      }
    }
  }

  return [followers, remaining];
}

function getHorizontalAndVerticalReferences(source: Vector, originHeading: number): MagnetReference[] {
  return [
    { source, heading: boundHeading(originHeading) },
    { source, heading: boundHeading(originHeading + 90) }
  ];
}

function getSiblingReferences(path: Path, target: AnyControl, followers: AnyControl[]): MagnetReference[] {
  const references: MagnetReference[] = [];

  const controls = path.controls;
  const idx = controls.indexOf(target);

  function findEndControl(step: number): EndControl | undefined {
    for (let i = idx + step; i >= 0 && i < controls.length; i += step) {
      if (controls[i] instanceof EndControl) return controls[i] as EndControl;
    }
    return undefined;
  }

  function func(c1: AnyControl, c2: AnyControl) {
    if (c1.visible && !followers.includes(c1) && c2.visible && !followers.includes(c2)) {
      references.push({ source: c1, heading: toHeading(c2.subtract(c1.toVector())) });
    }
  }

  if (idx >= 2) func(controls[idx - 1], controls[idx - 2]);
  if (idx < controls.length - 2) func(controls[idx + 1], controls[idx + 2]);

  const prevEndControl = findEndControl(-1);
  if (prevEndControl && !followers.includes(prevEndControl))
    references.push({ source: prevEndControl, heading: prevEndControl.heading });
  const nextEndControl = findEndControl(+1);
  if (nextEndControl && !followers.includes(nextEndControl))
    references.push({ source: nextEndControl, heading: nextEndControl.heading });

  return references;
}

function getSiblingControls(path: Path, target: EndControl): Control[] {
  const controls = path.controls;
  const idx = controls.indexOf(target);
  if (idx === -1) return [];

  const prev: AnyControl | undefined = controls[idx - 1];
  const next: AnyControl | undefined = controls[idx + 1];

  const siblingControls: Control[] = [];
  if (prev instanceof Control) siblingControls.push(prev);
  if (next instanceof Control) siblingControls.push(next);

  return siblingControls;
}

const ControlElement = observer((props: ControlElementProps) => {
  const { app } = getAppStores();

  const [justSelected, setJustSelected] = useState(false);
  const [posBeforeDrag, setPosBeforeDrag] = useState(new Vector(0, 0));

  function shouldInteract(event: Konva.KonvaEventObject<MouseEvent | TouchEvent>): boolean {
    const evt = event.evt;

    // UX: Do not interact with control points if itself or the path is locked
    // UX: Do not interact with control points if middle click
    if (props.cp.lock || props.path.lock || props.isGrabAndMove) {
      evt.preventDefault();
      event.target.stopDrag();
      return false;
    }

    return true;
  }

  function interact(isShiftKey: boolean) {
    setPosBeforeDrag(props.cp.toVector());

    if (isShiftKey) {
      // UX: Add selected control point if: left click + shift
      // UX: Prevent the control point from being removed when the mouse is released at the same round it is added
      setJustSelected(app.select(props.cp));
      // UX: Expand the path as the same time to show the control points
      app.addExpanded(props.path);
    } else {
      if (app.isSelected(props.cp) === false) {
        // UX: Select one control point if: left click + not pressing shift and target not selected
        app.setSelected([props.cp]);
        setJustSelected(false);
      }
    }
  }

  function onTouchStart(event: Konva.KonvaEventObject<TouchEvent>) {
    if (!shouldInteract(event)) return;

    event.evt.preventDefault();

    if (event.evt.touches.length === 1) {
      // UX: Select one control point if: touch + target not selected
      if (app.isSelected(props.cp) === false) {
        app.setSelected([props.cp]);
      }
  
      if (app.fieldEditor.isTouchingControl === false) {
        app.fieldEditor.isTouchingControl = "touch";
      }
    }
  }

  function onTouchMove(event: Konva.KonvaEventObject<TouchEvent>) {
    if (!shouldInteract(event)) return;

    event.evt.preventDefault();
  }

  function onTouchEnd(event: Konva.KonvaEventObject<TouchEvent>) {
    if (!shouldInteract(event)) return;

    const { app } = getAppStores();
  }

  function onMouseDown(event: Konva.KonvaEventObject<MouseEvent>) {
    const evt = event.evt;

    if (!shouldInteract(event)) return;

    if (evt.button === 0) {
      // left click
      interact(evt.shiftKey);
    } else if (evt.button === 1) {
      // middle click
      // UX: Do not interact with control points if not left click
      event.target.stopDrag();
    }
  }

  function onMouseClick(event: Konva.KonvaEventObject<MouseEvent>) {
    const evt = event.evt;

    if (!shouldInteract(event)) return;

    // UX: Remove selected entity if: release left click + shift + not being added recently
    if (evt.button === 0 && evt.shiftKey && !justSelected) {
      if (!justSelected) app.unselect(props.cp); // TODO code review
    }
  }

  function onDragMove(event: Konva.KonvaEventObject<DragEvent | TouchEvent>) {
    const evt = event.evt;

    // UX: Do not interact with control points if itself or the path is locked
    if (props.cp.lock || props.path.lock) {
      evt.preventDefault();

      const cpInUOL = props.cp.toVector(); // ALGO: Use toVector for better performance
      const cpInPx = props.fcc.toPx(cpInUOL);

      // UX: Set the position of the control point back to the original position
      event.target.x(cpInPx.x);
      event.target.y(cpInPx.y);
      return;
    }

    const oldCpInUOL = props.cp.toVector();

    // UX: Calculate the position of the control point by the client mouse position
    let cpInPx = props.fcc.getUnboundedPxFromEvent(event);
    if (cpInPx === undefined) return;
    let cpInUOL = props.fcc.toUOL(cpInPx);
    // first set the position of the control point so we can calculate the position of the follower control points
    props.cp.setXY(cpInUOL);

    const isControlFollow = !evt.ctrlKey;

    const [followers, remains] = getFollowersAndRemaining(app.paths, props.cp, app.selectedEntityIds, isControlFollow);

    if (props.cp instanceof EndControl && isControlFollow) {
      getSiblingControls(props.path, props.cp)
        .filter(cp => cp.visible && !cp.lock)
        .forEach(cp => {
          if (!followers.includes(cp)) followers.push(cp);
        });
    }

    if (evt.shiftKey) {
      const references: MagnetReference[] = [];

      references.push(...remains.flatMap(source => getHorizontalAndVerticalReferences(source, 0)));
      references.push(...getHorizontalAndVerticalReferences(posBeforeDrag, 0));
      references.push(...getSiblingReferences(props.path, props.cp, followers));

      const [result, magnetRefs] = magnet(cpInUOL, references, app.gc.controlMagnetDistance);
      cpInUOL.setXY(result);
      app.magnet = magnetRefs;
    } else {
      app.magnet = [];
    }

    app.history.execute(
      `Move control ${props.cp.uid} with ${followers.length} followers`,
      new DragControls(props.cp, oldCpInUOL, cpInUOL, followers),
      5000
    );

    cpInPx = props.fcc.toPx(cpInUOL);
    event.target.x(cpInPx.x);
    event.target.y(cpInPx.y);

    app.fieldEditor.isTouchingControl = "drag";
  }

  // function onDragEnd(event: Konva.KonvaEventObject<DragEvent | TouchEvent>) { }

  function onMouseUpControlPoint(event: Konva.KonvaEventObject<MouseEvent>) {
    if (!shouldInteract(event)) return;

    // Nothing to do
  }

  function onWheel(event: Konva.KonvaEventObject<WheelEvent>) {
    const evt = event.evt;

    // UX: Do not interact with control points if it is zooming
    if (!shouldInteract(event) || evt.ctrlKey) return;

    // UX: Do not interact with control points if it is not vertical scroll
    if (Math.abs(evt.deltaX) * 1.5 > Math.abs(evt.deltaY)) return;

    // UX: Do not interact with control points if it is panning
    if (!app.wheelControl("change heading value")) return;

    const epc = props.cp as EndControl;
    app.history.execute(
      `Update control ${epc.uid} heading value by scroll wheel`,
      new UpdatePathTreeItems([epc], { heading: epc.heading + evt.deltaY / 10 })
    );
  }

  const lineWidth = props.fcc.pixelHeight / 600;
  const cpRadius = (props.fcc.pixelHeight / 40) * (app.hoverItem === props.cp.uid ? 1.5 : 1);
  const cpInPx = props.fcc.toPx(props.cp.toVector()); // ALGO: Use toVector() for better performance
  const fillColor = app.isSelected(props.cp) ? "#5C469Cdf" : "#5C469C6f";

  function onClickFirstOrLastControlPoint(event: Konva.KonvaEventObject<MouseEvent>) {
    const evt = event.evt;

    onMouseClick(event);

    if (!shouldInteract(event)) return;

    // UX: Remove end point from the path, selected and expanded list if: right click
    if (evt.button === 2) {
      const command = new RemovePathsAndEndControls(app.paths, [props.cp as EndControl]);
      app.history.execute(`Remove paths and end controls`, command);
    }
  }

  const isEndControl = props.cp instanceof EndControl;

  return (
    <Portal selector=".selected-controls" enabled={app.isSelected(props.cp)}>
      <Circle
        x={cpInPx.x}
        y={cpInPx.y}
        radius={isEndControl ? cpRadius : cpRadius / 2}
        fill={fillColor}
        draggable
        onTouchStart={action(onTouchStart)}
        onTouchMove={action(onTouchMove)}
        onTouchEnd={action(onTouchEnd)}
        onWheel={isEndControl ? action(onWheel) : undefined}
        onMouseDown={action(onMouseDown)}
        // onMouseMove
        onMouseUp={action(onMouseUpControlPoint)}
        onDragMove={action(onDragMove)}
        // onDragEnd={action(onDragEnd)}
        onClick={action(onClickFirstOrLastControlPoint)}
      />
      {isEndControl && (
        <Line
          points={[
            cpInPx.x,
            cpInPx.y,
            cpInPx.x + Math.cos(fromHeadingInDegreeToAngleInRadian((props.cp as EndControl).heading)) * cpRadius,
            cpInPx.y - Math.sin(fromHeadingInDegreeToAngleInRadian((props.cp as EndControl).heading)) * cpRadius
          ]}
          stroke="#000"
          strokeWidth={lineWidth}
          listening={false}
        />
      )}
    </Portal>
  );
});

export { ControlElement };

