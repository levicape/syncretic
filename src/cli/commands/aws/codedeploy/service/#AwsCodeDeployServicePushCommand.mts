// CodeDeployServiceNextParameter -> {
//   $$class: "servicenext",
//   current: {
// 	$$class: "service",
// 	$$service: "<FOURTWO_SERVICE_VERSION>",
//  function: "AwsCodeDeployServiceLockCommand",
//  functionUrl: "https://service.fourtwo.io",
//  functionVersion: "<FOURTWO_SERVICE_VERSION>",
// 	};
//   next: {
// 	$$class: "service",
// 	$$service: "<FOURTWO_SERVICE_VERSION>",
//  function: "AwsCodeDeployServiceNextCommand",
//  functionUrl: "https://service.fourtwo.io",
//  functionVersion: "<FOURTWO_SERVICE_VERSION>",
// 	};
// 	};

// CodeDeployServiceCurrentParameter -> {
//   $$class: "servicecurrent",
//   current: {
// 	$$class: "service",
// 	$$service: "<FOURTWO_SERVICE_VERSION>",
//  function: "fgsfds",
//  functionUrl: "https://service.fourtwo.io",
//  functionVersion: "<FOURTWO_SERVICE_VERSION>",
// 	};
//   previous: {
// 	$$class: "service",
// 	$$service: "<FOURTWO_SERVICE_VERSION>",
//  function: "AwsCodeDeployServicePreviousCommand",
//  functionUrl: "https://service.fourtwo.io",
//  functionVersion: "<FOURTWO_SERVICE_VERSION>",
// 	};
// 	};

/*
AwsCodeDeployServiceLockParameter = (service) => (principal) => {
	/fourtwo/<principal>/codedeploy/service/<service>/lock
}
AwsCodeDeployServiceNextParameter = (service) => (principal) => {
	/fourtwo/<principal>/codedeploy/service/<service>/next
}
AwsCodeDeployServicePreviousParameter = (service) => (principal) => {
	/fourtwo/<principal>/codedeploy/service/<service>/previous
}
AWSCodeDeployServiceCurrentParameter = (service) => (principal) => {
	/fourtwo/<principal>/codedeploy/service/<service>/current
}
*/
