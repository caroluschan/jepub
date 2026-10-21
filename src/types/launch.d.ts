export {};

interface JepubFileHandle {
  getFile: () => Promise<File>;
}

interface JepubLaunchParams {
  files?: JepubFileHandle[];
}

interface JepubLaunchQueue {
  setConsumer: (consumer: (params: JepubLaunchParams) => void) => void;
}

declare global {
  interface Window {
    launchQueue?: JepubLaunchQueue;
  }
}
