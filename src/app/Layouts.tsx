import { Card } from "@mui/material";
import classNames from "classnames";
import { observer } from "mobx-react-lite";
import React from "react";
import { LayoutType } from "../core/Layout";
import { ControlAccordion } from "./ControlAccordion";
import { FieldCanvasElement } from "./FieldCanvasElement";
import { GeneralConfigAccordion } from "./GeneralConfigAccordion";
import { MenuAccordion } from "./MenuAccordion";
import { PathConfigAccordion } from "./PathAccordion";
import { PathTreeAccordion } from "./PathTreeAccordion";
import { SpeedCanvasElement } from "./SpeedCanvasElement";
import { getAppStores } from "../core/MainApp";
import { makeAutoObservable } from "mobx";
import MenuIcon from "@mui/icons-material/Menu";
import ViewListIcon from "@mui/icons-material/ViewList";
import TuneIcon from "@mui/icons-material/Tune";
import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";
import LinearScaleIcon from "@mui/icons-material/LinearScale";
// import WidgetsIcon from "@mui/icons-material/Widgets";
import TimelineIcon from "@mui/icons-material/Timeline";
import { Box, Typography } from "@mui/material";
import { GeneralConfigFloatingPanel } from "./GeneralConfigAccordion";
import { ControlFloatingPanel } from "./ControlAccordion";
import { PathConfigFloatingPanel } from "./PathAccordion";
import { PathTreeFloatingPanel } from "./PathTreeAccordion";
import { MenuMainDropdown } from "./MenuAccordion";
import UndoIcon from '@mui/icons-material/Undo';
import RedoIcon from '@mui/icons-material/Redo';
import HomeIcon from '@mui/icons-material/Home';

export const LayoutContext = React.createContext<LayoutType>(LayoutType.CLASSIC);
export const LayoutProvider = LayoutContext.Provider;

export const ClassisLayout = observer(() => {
  const { appPreferences } = getAppStores();

  return (
    <>
      <Box id="left-editor-panel">
        <MenuAccordion />
        <PathTreeAccordion />
      </Box>

      <Box id="middle-panel" className={classNames({ "full-height": !appPreferences.isSpeedCanvasVisible })}>
        <Card id="field-panel">
          <svg viewBox="0 0 1 1"></svg>
          <FieldCanvasElement />
        </Card>
        {appPreferences.isSpeedCanvasVisible && (
          <Card id="speed-panel">
            <SpeedCanvasElement />
          </Card>
        )}
      </Box>
      {appPreferences.isRightPanelVisible && (
        <Box id="right-editor-panel">
          <GeneralConfigAccordion />
          <ControlAccordion />
          <PathConfigAccordion />
        </Box>
      )}
    </>
  );
});

class ExclusiveLayoutVariables {
  private panelStates: { [key: string]: boolean } = {};

  isOpenPanel(panel: string): boolean {
    return this.panelStates[panel] ?? false;
  }

  openPanel(panel: string) {
    this.panelStates[panel] = true;
  }

  togglePanel(panel: string) {
    this.panelStates[panel] = !this.isOpenPanel(panel);
  }

  closePanel(panel: string) {
    this.panelStates[panel] = false;
  }

  constructor() {
    makeAutoObservable(this);
  }
}

export const ExclusiveLayout = observer(() => {
  const { app } = getAppStores();

  const [variables] = React.useState(() => new ExclusiveLayoutVariables());

  return (
    <>
      <Box id="exclusive-field">
        <FieldCanvasElement />
      </Box>
      <Box className="panel-icon-box" style={{ left: "8px", top: "8px" }}>
        <Box id="menu-icon" className="panel-icon" onClick={() => variables.togglePanel("menu")}>
          <MenuIcon fontSize="large" />
        </Box>
        <Box className="panel-icon" onClick={() => variables.togglePanel("paths")}>
          <ViewListIcon fontSize="large" />
        </Box>
      </Box>
      <Box className="panel-icon-box" style={{ right: "8px", top: "8px" }}>
        <Box className="panel-icon" onClick={() => variables.togglePanel("general-config")}>
          <TuneIcon fontSize="large" />
        </Box>
        <Box className="panel-icon" onClick={() => variables.togglePanel("control")}>
          <FiberManualRecordIcon fontSize="large" />
        </Box>
        <Box className="panel-icon" onClick={() => variables.togglePanel("path")}>
          <LinearScaleIcon fontSize="large" />
        </Box>
        {/* <Box className="panel-icon">
          <WidgetsIcon fontSize="large" />
        </Box> */}
        <Box className="panel-icon" onClick={() => variables.togglePanel("speed-graph")}>
          <TimelineIcon fontSize="large" />
        </Box>
      </Box>
      <Box className="panel-icon-box" style={{ right: "8px", bottom: "0px" }}>
        <Box className={classNames("panel-icon", {"disabled": !app.history.canUndo})} onClick={() => app.history.undo()}>
          <UndoIcon fontSize="large" />
        </Box>
        <Box className={classNames("panel-icon", {"disabled": !app.history.canRedo})} onClick={() => app.history.redo()}>
          <RedoIcon fontSize="large" />
        </Box>
        <Box className="panel-icon" onClick={() => app.resetFieldOffsetAndScale()}>
          <HomeIcon fontSize="large" />
        </Box>
      </Box>
      <Box id="left-editor-panel">
        <MenuMainDropdown
          anchor={document.getElementById("menu-icon")!}
          isOpen={variables.isOpenPanel("menu")}
          onClose={variables.closePanel.bind(variables, "menu")}
        />
        {variables.isOpenPanel("paths") && <PathTreeFloatingPanel />}
      </Box>
      <Box id="right-editor-panel">
        {variables.isOpenPanel("general-config") && <GeneralConfigFloatingPanel />}
        {variables.isOpenPanel("control") && <ControlFloatingPanel />}
        {variables.isOpenPanel("path") && <PathConfigFloatingPanel />}
      </Box>
      {variables.isOpenPanel("speed-graph") && (
        <Box id="speed-panel">
          {app.interestedPath() ? <SpeedCanvasElement /> : <Typography>(No path to display)</Typography>}
        </Box>
      )}
    </>
  );
});