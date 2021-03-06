$(document).ready( function() {
	//////////////////////////////////////////////////////////////
	//  					    PRAMETERS						//
	//////////////////////////////////////////////////////////////
	var apiURI = null;
	
	var sHost = null, 
		sPort = null;

    var portRTP = 5006;
	
    var inputWidth = 0,
        inputHeight =0,
        winWidth = 0,
        winHeight = 0;

	var lmsInstance = null, 
        lmsState = null,
		lmsInput = null,
        lmsVideos = [],
        lmsAudios = [],
        lmsPaths = [];
    
    var listCrops = [];
    var zIndexMax = 0;
    var idCrops = 1;

    var receiverId = 1000,
    	decoderId = 1100,
    	resamplerId = 1200,
    	videoSplitterId = 1300,
    	encoderId = 1401,
    	transmitterId = 1500,
    	pathTransmitterId = 2000;

    var data = "text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(listCrops));

    //////////////////////////////////////////////////////////////
    //                       EVENTS MANAGMENT                   //
    //////////////////////////////////////////////////////////////
	$("#view").load("./app/views/instance.html");

	$('#crop_modal').modal('show');

	$( document ).on( "submit", "form", function(event) {
        event.preventDefault(); // To prevent following the link (optional)
        var form = $(this);
        console.log(form.context.id);
        switch (form.context.id){
            case 'connectForm':
                connectForm(form);
                break;
            case 'setRTMPForm':
                setRTMPForm(form);
                break;
            case 'setRTSPForm':
                setRTSPForm(form);
                break;
            case 'setRTPvideoForm':
                setRTPForm(form);
                break;
            case 'setRTPavForm':
                setRTPForm(form);
                break;
            case 'setRTPaudioForm':
                setRTPForm(form);
                break;
            case 'createCropForm':
                createCropForm(form);
                break;
            case 'configureCropForm':
                configureCropForm(Number(document.getElementById('select-crop').textContent.substr(4,1)));
                break; 
            case 'configureAllCrops':
                for(crop in listCrops){
                    configureCropForm(listCrops[crop].id);
                }
                break;
            case 'deleteCrop':
                deleteCrop();
                break;
            case 'configureFrameTimeForm':
                configureFrameTimeForm(form);
                break;
            case 'playRTP':
                playRTP();
                break;
            case 'forceIntra':
                forceIntra();
                break; 
            default:
                addAlertError('ERROR: no form available');
        }
    });

    $('#disconnect').on('click', function(event) {
        bootbox.confirm("Are you sure to disconnect? This implies restarting the app...", function(result) {
            if(result){
                var uri = apiURI + '/disconnect';
                $.ajax({
                    type: 'GET',
                    url: uri,
                    dataType: 'json',
                    success : function(msg) {
                        if(!msg.error){
                            lmsVideos = [];
                            lmsAudios = [];
                            lmsInstance = null;
                            lmsState = null;
                            lmsPaths = [];
                            listCrops = [];
                            idCrops = 1;
                            addAlertSuccess(msg.message);
                            apiURI = null;
                            sHost = null;
                            sPort = null;
                            $("#disconnect").addClass("hidden");
                            $("#collapseButton").addClass("hidden");                            
                            $("#saveConfig").addClass("hidden");                            
                            $("#openConfig").addClass("hidden");                            
                            $("#state").html('');
                            $("#view").load("./app/views/instance.html");
                        } else {
                            addAlertError(msg.error);
                        }
                    },
                    error : function(xhr, msg) {
                        addAlertError('ERROR: ' + msg + ' - ' + xhr.responseText+ ' - No API available');
                    }
                })
            }
        });
    });

    $('#saveConfig').on('click', function(event){
        console.log("Save Config");
        var data = "text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(listCrops));
        var file = document.createElement('a');
        file.href = 'data:' + data;
    });

    $('#openConfig').on('click', function(event){
        console.log("Open Config");
        $("#selector-files").click();
    });

    $("#selector-files").change(function () {
        
        var file=$(this).val();
        if (!file) return;
        console.log(file);

        
    });

    window.addEventListener("beforeunload", function(event){
        event  = event || window.event;
        var reloadMessage = "\tALERT: If you refresh this page, you may lose settings.";
        event.returnValue = reloadMessage;
        return reloadMessage;
    });

    $(window).resize(function(){
        var grid = document.getElementById('grid-snap');
        var nWinWidth = Number($("#grid-snap").width());
        var nWinHeight=Number(((inputHeight*nWinWidth)/inputWidth).toFixed(0));
        
        for(crop in listCrops){
            var div = document.getElementById('crop' + listCrops[crop].id);
            var nWidth = Number((div.style.width.replace(/\D/g,''))*(nWinWidth/winWidth)).toFixed(0);
            var nHeight = Number((div.style.height.replace(/\D/g,''))*(nWinHeight/winHeight)).toFixed(0);
            var x = ((parseInt(div.getAttribute('data-x')) || 0)*(nWinWidth/winWidth)).toFixed(0);
            var y = ((parseInt(div.getAttribute('data-y')) || 0)*(nWinHeight/winHeight)).toFixed(0);

            grid.style.height= nWinHeight+'px';
            div.style.maxWidth = nWinWidth + "px";
            div.style.maxHeight = nWinHeight + "px";
            div.style.width = nWidth + "px";
            div.style.height = nHeight + "px";
            div.setAttribute('data-x', x);
            div.setAttribute('data-y', y);
        }
        winWidth = nWinWidth;
        winHeight=nWinHeight;
        for(crop in listCrops){
            var div = document.getElementById('crop' + listCrops[crop].id);
            setCrop(div);
        }
        
    });

    window.addEventListener('orientationchange', function(){
        var grid = document.getElementById('grid-snap');
        var nWinWidth = Number($("#grid-snap").width());
        var nWinHeight=Number(((inputHeight*nWinWidth)/inputWidth).toFixed(0));
        grid.style.height= nWinHeight+'px';
        for(crop in listCrops){
            var div = document.getElementById('crop' + listCrops[crop].id);
            var nWidth = Number((div.style.width.replace(/\D/g,''))*(nWinWidth/winWidth)).toFixed(0);
            var nHeight = Number((div.style.height.replace(/\D/g,''))*(nWinHeight/winHeight)).toFixed(0);
            var x = ((parseInt(div.getAttribute('data-x')) || 0)*(nWinWidth/winWidth)).toFixed(0);
            var y = ((parseInt(div.getAttribute('data-y')) || 0)*(nWinHeight/winHeight)).toFixed(0);

            div.style.maxWidth = nWinWidth + "px";
            div.style.maxHeight = nWinHeight + "px";
            div.style.width = nWidth + "px";
            div.style.height = nHeight + "px";
            div.setAttribute('data-x', x);
            div.setAttribute('data-y', y);
        }
        winWidth = nWinWidth;
        winHeight=nWinHeight;
        for(crop in listCrops){
            var div = document.getElementById('crop' + listCrops[crop].id);
            setCrop(div);
        }
        
    });
	//////////////////////////////////////////////////////////////
	//  					    FORMS							//
	//////////////////////////////////////////////////////////////

	function connectForm(form) {
        var message = { 
            'host' : form.find( "input[id='server-host']" ).val(),
            'port' : form.find( "input[id='server-port']" ).val()
        };
        var apiHost = form.find( "input[id='api-host']" ).val();
        var apiPort = form.find( "input[id='api-port']" ).val();

        sHost = form.find( "input[id='server-host']" ).val();
        sPort = form.find( "input[id='server-port']" ).val();

        var uri = 'http://'+apiHost+':'+apiPort+'/api/connect';
        $.ajax({
            type: 'POST',
            url: uri,
            data: message,
            dataType: 'json',
            success : function(msg) {
                if(!msg.error){
                    lmsInstance = message;
                    addAlertSuccess(msg.message);
                    apiURI = 'http://'+apiHost+':'+apiPort+'/api';
                    console.log(apiURI);
                    $("#disconnect").removeClass("hidden");
                    $("#openConfig").removeClass("hidden");
                    $("#collapseButton").removeClass("hidden");
                    $("#view").load("./app/views/input.html");
                } else {
                    lmsInstance = null;
                    addAlertError(msg.error);
                }
            },
            error : function(xhr, msg) {
                lmsInstance = null;
                addAlertError('ERROR: \
                ' + msg + ' - ' + xhr.responseText+ ' - No API available');
            }
        })
    };

    function setRTMPForm(form) {
        var uri = form.find( "input[id='uri']" ).val();
        if(/^(rtmp):\/\/[^ "]+$/.test(uri)){
            lmsInput = {
                'params': {
                    'uri' : uri
                }
            };   
            addAlertSuccess('Success setting network input params');

            setReceiverToSplitterRTMP();
            createFilter(transmitterId, "transmitter");
            $("#view").load("./app/views/splitter.html", function(res, stat, xhr) {
                if(stat="succes"){
                    getState();
                    var content = document.getElementById('contentCrop');
                    var spinner = new Spinner().spin();
                    content.appendChild(spinner.el);
                    for(var filterIn in lmsState.filters){
                        if (lmsState.filters[filterIn].type == "videoDecoder"){
                            while(Number(lmsState.filters[filterIn].inputInfo.height)==0){
                                getState();
                            }
                            content.removeChild(spinner.el);
                            inputWidth = Number(lmsState.filters[filterIn].inputInfo.width);
                            inputHeight = Number(lmsState.filters[filterIn].inputInfo.height);
                            var grid = document.getElementById('grid-snap');
                            winWidth = Number($("#grid-snap").width());
                            winHeight=Number(((inputHeight*winWidth)/inputWidth).toFixed(0));
                            grid.style.height= winHeight+'px';
                            break;
                        }
                    }
                }
            });
        } else {
            lmsInput = null;
            addAlertError('ERROR: no valid inputs... please check.');
        }
    };

    function setRTSPForm(form) {
        var uri = form.find( "input[id='uri']" ).val();
        if(/^(rtsp):\/\/[^ "]+$/.test(uri)){
            lmsInput = {
                'params'    : {
                    "uri"       : uri,
                    "progName"  : "LiveMediaStreamer",
                    "id": "8554"
                }
            };  
            addAlertSuccess('Success setting network input params');

            setReceiverToSplitterRTSP();
            createFilter(transmitterId, "transmitter");
            $("#view").load("./app/views/splitter.html", function(res, stat, xhr) {
                if(stat="succes"){
                    getState();
                    var content = document.getElementById('contentCrop');
                    var spinner = new Spinner().spin();
                    content.appendChild(spinner.el);
                    for(var filterIn in lmsState.filters){
                        if (lmsState.filters[filterIn].type == "videoDecoder"){
                            while(Number(lmsState.filters[filterIn].inputInfo.height)==0){
                                getState();
                            }
                            content.removeChild(spinner.el);
                            inputWidth = Number(lmsState.filters[filterIn].inputInfo.width);
                            inputHeight = Number(lmsState.filters[filterIn].inputInfo.height);
                            var grid = document.getElementById('grid-snap');
                            winWidth = Number($("#grid-snap").width());
                            winHeight=((inputHeight*winWidth)/inputWidth).toFixed(0);
                            grid.style.height= winHeight+'px';
                            break;
                        }
                    }
                }
            });
        } else {
            lmsInput = null;
            addAlertError('ERROR: no valid inputs... please check.');
        }
    };

    function setRTPForm(form) {
        switch(form.find( "input[name='rtpInput']" ).val()){
            case 'v':
                var vport = form.find( "input[name='port']" ).val();
                if(form.find( "select[name='codec']" ).val() === "none" || isNaN(vport)){
                    lmsInput = null;
                    addAlertError('ERROR: no valid inputs... please check.');
                } else {
                    lmsInput = {
                        'params'    : {
                            "subsessions":[
                                {
                                    "medium":"video",
                                    "codec":form.find( "select[name='codec']" ).val(),
                                    "bandwidth":5000,
                                    "timeStampFrequency":90000,
                                    "channels":null,
                                    "port":parseInt(vport)
                                }   
                            ]
                        }
                    };
                    addAlertSuccess('Success setting network input params');
                    createFilter(receiverId, "receiver");
                    setReceiverToSplitter(form.find( "input[name='rtpInput']" ).val());
                    createFilter(transmitterId, "transmitter");
                    $("#view").load("./app/views/splitter.html", function(res, stat, xhr) {
                        if(stat="succes"){
                            getState();
                            var content = document.getElementById('contentCrop');
                            var spinner = new Spinner().spin();
                            content.appendChild(spinner.el);
                            for(var filterIn in lmsState.filters){
                                if (lmsState.filters[filterIn].type == "videoDecoder"){
                                    while(Number(lmsState.filters[filterIn].inputInfo.height)==0){
                                        getState();
                                    }
                                    content.removeChild(spinner.el);
                                    inputWidth = Number(lmsState.filters[filterIn].inputInfo.width);
                                    inputHeight = Number(lmsState.filters[filterIn].inputInfo.height);
                                    var grid = document.getElementById('grid-snap');
                                    winWidth = Number($("#grid-snap").width());
                                    winHeight=Number(((inputHeight*winWidth)/inputWidth).toFixed(0));
                                    grid.style.height= winHeight+'px';
                                    break;
                                }
                            }
                        }
                    });
                }
                break;
            case 'a':
                var aport = form.find( "input[name='port']" ).val();
                if(form.find( "select[name='codec']" ).val() === "none" 
                    || form.find( "select[name='sampleRate']" ).val() === "none" 
                    || form.find( "select[name='channels']" ).val() === "none"
                    || isNaN(aport)){
                        lmsInput = null;
                        addAlertError('ERROR: no valid inputs... please check.');
                } else {
                    lmsInput = {
                        'params'    : {
                            "subsessions":[
                                {
                                    "medium":"audio",
                                    "codec":form.find( "select[name='codec']" ).val(),
                                    "bandwidth":192000,
                                    "timeStampFrequency":parseInt(form.find( "select[name='sampleRate']" ).val()),
                                    "channels":parseInt(form.find( "select[name='channels']" ).val()),
                                    "port":parseInt(aport),
                                }   
                            ]
                        }
                    };
                    addAlertSuccess('Success setting network input params');

                    createFilter(receiverId, "receiver");
                    createFilter(transmitterId, "transmitter");
                    setReceiverToTransmitterAudio(form.find( "input[name='rtpInput']" ).val());

                    $("#view").load("./app/views/splitter.html", function(res, stat, xhr) {
                    });
                }
                break;
            case 'av':
                var aport = form.find( "input[name='audio-port']" ).val();
                var vport = form.find( "input[name='video-port']" ).val();
                if(form.find( "select[name='audio-codec']" ).val() === "none" 
                    || form.find( "select[name='video-codec']" ).val() === "none"
                    || form.find( "select[name='sampleRate']" ).val() === "none" 
                    || form.find( "select[name='channels']" ).val() === "none"
                    || isNaN(aport)
                    || isNaN(vport)){
                        lmsInput = null;
                        addAlertError('ERROR: no valid inputs... please check.');
                } else {
                    lmsInput = {
                        'audioParams'    : {
                            "subsessions":[
                                {
                                    "medium":"audio",
                                    "codec":form.find( "select[name='audio-codec']" ).val(),
                                    "bandwidth":192000,
                                    "timeStampFrequency":parseInt(form.find( "select[name='sampleRate']" ).val()),
                                    "channels":parseInt(form.find( "select[name='channels']" ).val()),
                                    "port":parseInt(aport),
                                }   
                            ]
                        },
                        'videoParams'    : {
                            "subsessions":[
                                {
                                    "medium":"video",
                                    "codec":form.find( "select[name='video-codec']" ).val(),
                                    "bandwidth":5000,
                                    "timeStampFrequency":90000,
                                    "channels":null,
                                    "port":parseInt(vport),
                                }   
                            ]
                        }
                    };
                    addAlertSuccess('Success setting network input params');

                    createFilter(receiverId, "receiver");
                    createFilter(transmitterId, "transmitter");
                    setReceiverToTransmitterAudio(form.find( "input[name='rtpInput']" ).val());
                    setReceiverToSplitter(form.find( "input[name='rtpInput']" ).val());

                    $("#view").load("./app/views/splitter.html", function(res, stat, xhr) {
                        if(stat="succes"){
                            getState();
                            var content = document.getElementById('contentCrop');
                            var spinner = new Spinner().spin();
                            content.appendChild(spinner.el);
                            for(var filterIn in lmsState.filters){
                                if (lmsState.filters[filterIn].type == "videoDecoder"){
                                    while(Number(lmsState.filters[filterIn].inputInfo.height)==0){
                                        getState();
                                    }
                                    content.removeChild(spinner.el);
                                    inputWidth = Number(lmsState.filters[filterIn].inputInfo.width);
                                    inputHeight = Number(lmsState.filters[filterIn].inputInfo.height);
                                    var grid = document.getElementById('grid-snap');
                                    winWidth = Number($("#grid-snap").width());
                                    winHeight=Number(((inputHeight*winWidth)/inputWidth).toFixed(0));
                                    grid.style.height= winHeight+'px';
                                    break;
                                }
                            }
                        }
                    });
                }
                break;
            default:
                lmsInput = null;
                addAlertError('ERROR: no valid inputs... please check.');
                break;
        }
    };


    function createCropForm(form){
        var width = 0.5,
            height = 0.5;
        var ipval = true;


        $('#crop_modal').modal('hide');
        if (ipval){
        	var message = { 
        		'id' : idCrops,
                'ip' : form.find( "input[id='ip-destination']" ).val(),
                'x' : 0,
                'y' : 0,
                'width' : width,
                'height' : height,
                'pathId': pathTransmitterId
            };
            
            var grid = document.getElementById('grid-snap');
            var div = document.createElement('div');
            
            div.id = 'crop' + idCrops;
        	div.className = 'outputCrop';
        	div.style.maxWidth = winWidth + "px";
        	div.style.maxHeight = winHeight + "px";
            div.style.minWidth = (winWidth/10) + "px";
            div.style.minHeight = (winHeight/10) + "px";
            div.style.width = (message.width * winWidth) + "px";
            div.style.height = (message.height * winHeight)  + "px";
        	div.innerHTML =  '#crop' + idCrops;
         	document.getElementById('grid-snap').appendChild(div);
         	
            addCropToList(message);
         	setSplitterToTransmitter(message);
            setCrop(div);
            if(listCrops.length==1){
                $("#configureCropForm").removeClass("hidden");
                $("#deleteCrop").removeClass("hidden");
            }
            if(listCrops.length>1){$("#configureAllCrops").removeClass("hidden");};
            $("#saveConfig").removeClass("hidden");
            ++idCrops;
         	
            data = "text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(listCrops));
            var file = document.getElementById('saveConfig');
            file.href = 'data:' + data;
            var date = new Date();
            file.download = 'VideoWallConfig' + date.getFullYear() + (date.getMonth() +1) + date.getDate() + '.json';
            
        } else {
            addAlertError('ERROR: This IP is currently used');
        }
    };

    

    function configureCropForm(crop){
        var object = listCrops.filter(function(element) {return element.id == crop})[0];
        var width,
            height;
        if(Number(object.width) % 2 == 1) {
            width = Number(object.width) + 1;
        } else {
            width = Number(object.width);
        }

        if(Number(object.height) % 2 == 1) {
            height = Number(object.height) + 1;
        } else {
            height = Number(object.height);
        }

        var lmsSplitter = {
                        'params'    : {
                            "id": Number(object.id),
                            "width": width/inputWidth,
                            "height":height/inputHeight,
                            "x":Number(object.x/inputWidth),
                            "y":Number(object.y/inputHeight)
                        }
                    };
        console.log(lmsSplitter);
        configureFilter(videoSplitterId, "configCrop", lmsSplitter.params);
        data = "text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(listCrops));
        var file = document.getElementById('saveConfig');
        file.href = 'data:' + data;
        var date = new Date();
        file.download = 'VideoWallConfig' + date.getFullYear() + (date.getMonth() +1) + date.getDate() + '.json';
    };

    function configureFrameTimeForm(form){
        var lmsSplitter = {
                        'params'    : {
                            "fTime": Number(form.find( "input[id='frame-time']" ).val())
                        }
                    };
        configureFilter(videoSplitterId, "configure", lmsSplitter.params)
    };

    function deleteCrop(){
        var idSelected = Number(document.getElementById('select-crop').textContent.substr(4,1));
        var pathDeleted = listCrops.filter(function(element) {return element.id == idSelected})[0];
        
        if(deletePath(pathDeleted.pathId)){
            lmsPaths.splice(lmsPaths.map(function(element) {return element.id}).indexOf(pathDeleted.pathId), 1);
            listCrops.splice(listCrops.map(function(element) {return element.id}).indexOf(idSelected), 1);
            document.getElementById('grid-snap').removeChild(document.getElementById(document.getElementById('select-crop').textContent));

            document.getElementById('select-crop').textContent ="";
            document.getElementById('x-crop').textContent ="";
            document.getElementById('y-crop').textContent ="";
            document.getElementById('width-crop').textContent ="";
            document.getElementById('height-crop').textContent ="";
        }

    };

    function playRTP(){
        for(crop in listCrops){
            setPlayUrl(listCrops[crop].ip);
        }
    };

    function forceIntra(){
        var lmsEncoder = {'params':{}};
        configureFilter(1401, "forceIntra", lmsEncoder.params);
        configureFilter(1402, "forceIntra", lmsEncoder.params);
    };
    //////////////////////////////////////////////////////////////
	//  			SPECIFIC SCENARIO/UI METHODS				//
	//////////////////////////////////////////////////////////////
	function addCropToList(message){
    	listCrops.push(message);
    };

    function countLayer(){
        var count = listCrops.length;
        for (var i = 0;i<count; i++){
            if(document.getElementById("crop"+listCrops[i].id).style.zIndex>zIndexMax){
                zIndexMax=Number(document.getElementById("crop"+listCrops[i].id).style.zIndex);
            }
        };
    };

    function setCrop(tarjet){
        var object = listCrops.filter(function(element) {return element.id == tarjet.id.substr(4,1)})[0];
        var inputCrop = document.getElementById('select-crop');
        var inputX = document.getElementById('x-crop');
        var inputY = document.getElementById('y-crop');
        var inputW = document.getElementById('width-crop');
        var inputH = document.getElementById('height-crop');
        var cropDiv = document.getElementById('crop'+ object.id);
        
        object.x = (cropDiv.getAttribute('data-x')*inputWidth/winWidth).toFixed(0) || 0;
        object.y = (cropDiv.getAttribute('data-y')*inputHeight/winHeight).toFixed(0) || 0;
        if(object.x<0) object.x=0;
        if(object.y<0) object.y=0;
        object.width = (cropDiv.clientWidth*inputWidth/winWidth).toFixed(0);
        object.height = (cropDiv.clientHeight*inputHeight/winHeight).toFixed(0);

        inputCrop.innerHTML = 'crop'+object.id;
        inputX.innerHTML = object.x;
        inputY.innerHTML = object.y;
        inputW.innerHTML = object.width;
        inputH.innerHTML = object.height;
    }

    function setSplitterToTransmitter(message){
    	
        //CREATE RESAMPLER 
        createFilter(resamplerId, "videoResampler");
     	var lmsResampler = {
                        'params'    : {
                            "width": 0,
				            "height": 0,
				            "discartPeriod":0,
				            "pixelFormat":2
                        }
                    };
		configureFilter(resamplerId, "configure", lmsResampler.params);
		
        //CREATE ENCODER
        createFilter(encoderId, "videoEncoder");
		var lmsEncoder = {
                        'params'    : {
                            "bitrate":1000,
				            "fps":25,
				            "gop":25,
				            "lookahead":0,
				            "threads":4,
				            "annexb":true,
				            "preset":"superfast"
                        }
                    };
        configureFilter(encoderId, "configure", lmsEncoder.params);
     	
        //CREATE PATH
        var midFiltersIds = [resamplerId, encoderId];
        createPath(pathTransmitterId, videoSplitterId, transmitterId, idCrops, idCrops, midFiltersIds);
     	
        //CONFIGURE CROP
        var object = listCrops.filter(function(element) {return element.id == idCrops})[0];
        
    	
     	var lmsSplitter = {
                        'params'    : {
                            "id": Number(message.id),
                            "width": Number(message.width),
                            "height":Number(message.height),
                            "x":Number(message.x),
                            "y":Number(message.y)
                        }
                    };
		configureFilter(videoSplitterId, "configCrop", lmsSplitter.params);
		//CONFIGURE TRANSMITTER RTSP
        var plainrtp = "plainrtp" + idCrops;
		var lmsTransmitter = {
                        'params'    : {
                            "id":idCrops,
				            "txFormat":"std",
				            "name":plainrtp,
				            "info":plainrtp,
				            "desc":plainrtp,
				            "readers":[idCrops]
                        }
                    };
		configureFilter(transmitterId, "addRTSPConnection", lmsTransmitter.params);
        //CONFIGURE TRANSMITTER RTP
        /*lmsTransmitter = {
                        'params'    : {
                            "id":idCrops*100,
                            "txFormat":"std",
                            "ip":message.ip,
                            "port":portRTP,
                            "readers":[idCrops]
                        }
                    };
        configureFilter(transmitterId, "addRTPConnection", lmsTransmitter.params);*/
     	++pathTransmitterId;
     	++resamplerId;
     	++encoderId;
        portRTP = portRTP + 2;
    };

	function setReceiverToSplitter(rtpType){
        createFilter(decoderId, "videoDecoder");
        createFilter(resamplerId, "videoResampler");
        var lmsResampler = {
                        'params'    : {
                            "width":0,
                            "height":0,
                            "discartPeriod":0,
                            "pixelFormat":0
                        }
                    };
        configureFilter(resamplerId, "configure", lmsResampler.params);
        createFilter(videoSplitterId, "videoSplitter");
        var midFiltersIds = [decoderId,resamplerId];

        switch(rtpType){
            case 'v':
                configureFilter(receiverId, 'addSession', lmsInput.params);
                createPath(lmsInput.params.subsessions[0].port, receiverId, videoSplitterId, lmsInput.params.subsessions[0].port, -1, midFiltersIds);
                break;
            case 'av':
                configureFilter(receiverId, 'addSession', lmsInput.videoParams);
                createPath(lmsInput.videoParams.subsessions[0].port, receiverId, videoSplitterId, lmsInput.videoParams.subsessions[0].port, -1, midFiltersIds);
                break;
        }
		++resamplerId;
	};

    function setReceiverToSplitterRTMP(){
        createFilter(receiverId, "receiver");
        configureFilter(receiverId, 'configure', lmsInput.params);
        createFilter(decoderId, "videoDecoder");
        createFilter(resamplerId, "videoResampler");
        var lmsResampler = {
                        'params'    : {
                            "width":0,
                            "height":0,
                            "discartPeriod":0,
                            "pixelFormat":0
                        }
                    };
        configureFilter(resamplerId, "configure", lmsResampler.params);
        createFilter(videoSplitterId, "videoSplitter");
        var midFiltersIds = [decoderId,resamplerId];
        getState();
        var count = 0;
        while (lmsState.filters[0].sessions.length == 0 && count < 100 ){
            getState();
            count++;
        }
        if (count < 100){
            console.log(lmsState.filters[0].sessions[0].subsessions[0]);
            createPath(lmsState.filters[0].sessions[0].subsessions[0].port, receiverId, videoSplitterId, lmsState.filters[0].sessions[0].subsessions[0].port, -1, midFiltersIds);      
            ++resamplerId;
        } else {
            addAlertError("ERROR: The uri is not correct!")
        }
    };

    function setReceiverToSplitterRTSP(){
        createFilter(receiverId, "receiver");
        configureFilter(receiverId, 'addSession', lmsInput.params);
        createFilter(decoderId, "videoDecoder");
        createFilter(resamplerId, "videoResampler");
        var lmsResampler = {
                        'params'    : {
                            "width":0,
                            "height":0,
                            "discartPeriod":0,
                            "pixelFormat":0
                        }
                    };

        configureFilter(resamplerId, "configure", lmsResampler.params);
        createFilter(videoSplitterId, "videoSplitter");
        var midFiltersIds = [decoderId,resamplerId];
        getState();
        var count = 0;
        while (lmsState.filters[0].sessions.length == 0 && count < 100 ){
            getState();
            count++;
        }
        if (count < 100){
            createPath(lmsState.filters[0].sessions[0].subsessions[0].port, receiverId, videoSplitterId, lmsState.filters[0].sessions[0].subsessions[0].port, -1, midFiltersIds);      
            ++resamplerId;
        } else {
            addAlertError("ERROR: The uri is not correct!")
        }
    };
    
    function setReceiverToTransmitterAudio(rtpType){

        var midFiltersIds = [];
        switch(rtpType){
            case 'a':
                configureFilter(receiverId, 'addSession', lmsInput.params);
                createPath(lmsInput.params.subsessions[0].port, receiverId, transmitterId, lmsInput.params.subsessions[0].port, lmsInput.params.subsessions[0].port, midFiltersIds);
                var plainrtp = "plainrtp" + lmsInput.params.subsessions[0].port;
                var lmsTransmitter = {
                                'params'    : {
                                    "id":lmsInput.params.subsessions[0].port,
                                    "txFormat":"std",
                                    "name":plainrtp,
                                    "info":plainrtp,
                                    "desc":plainrtp,
                                    "readers":[lmsInput.params.subsessions[0].port]
                                }
                            };
                break;
            case 'av':
                configureFilter(receiverId, 'addSession', lmsInput.audioParams);
                createPath(lmsInput.audioParams.subsessions[0].port, receiverId, transmitterId, lmsInput.audioParams.subsessions[0].port, lmsInput.audioParams.subsessions[0].port, midFiltersIds);
                var plainrtp = "plainrtp" + lmsInput.audioParams.subsessions[0].port;
                var lmsTransmitter = {
                                'params'    : {
                                    "id":lmsInput.audioParams.subsessions[0].port,
                                    "txFormat":"std",
                                    "name":plainrtp,
                                    "info":plainrtp,
                                    "desc":plainrtp,
                                    "readers":[lmsInput.audioParams.subsessions[0].port]
                                }
                            };
                break;
        }
        configureFilter(transmitterId, "addRTSPConnection", lmsTransmitter.params);
        ++encoderId;
    };

    //////////////////////////////////////////////////////////////
	//  				SPECIFIC API METHODS					//
	//////////////////////////////////////////////////////////////
    function configureFilter(filterId, action, params) {
        var okmsg = false;
        var message = [{
                        "action":action,
                        "params":params
                    }];
        $.ajax({
            type: 'PUT',
            async: false,
            url: apiURI+'/filter/'+filterId,
            data: JSON.stringify(message),
            contentType: "application/json; charset=utf-8",
            traditional: true,
            success : function(msg) {
                if(!msg.error){
                    console.log("CONFIGURE FILTER");
                    console.log(msg.message);
                    $("#state").append('<p>'+msg.message+'</p>');
                    okmsg = true;
                } else {
                    console.log(msg.error);
                }
            },
            error : function(xhr, msg) {
                console.log('ERROR: \
                ' + msg + ' - ' + xhr.responseText+ ' - No API available');
            }
        })         
        return okmsg;
    };  

    function createFilter(filterId, type) {
        var okmsg = false;
        var message = {'id' : Number(filterId), 'type' : type};

        $.ajax({
            type: 'POST',
            async: false,
            url: apiURI+'/createFilter',
            data: JSON.stringify(message),
            contentType: "application/json; charset=utf-8",
            traditional: true,
            success : function(msg) {
                if(!msg.error){
                    console.log("CREATE FILTER");
                    console.log(msg.message);
                    $("#state").append('<p>'+msg.message+'</p>');
                    okmsg = true;
                } else {
                    console.log(msg.error);
                }
            },
            error : function(xhr, msg) {
                console.log('ERROR: \
                ' + msg + ' - ' + xhr.responseText+ ' - No API available');
            }
        })         
        return okmsg;
    };       

    function createPath(pathId, orgFilterId, dstFilterId, orgWriterId, dstReaderId, midFiltersIds) {
        var okmsg = false;
        var message = { 'id' : pathId, 'orgFilterId' : orgFilterId, 'dstFilterId' : dstFilterId, 
                        'orgWriterId' : orgWriterId, 'dstReaderId' : dstReaderId, 'midFiltersIds' : midFiltersIds };
        lmsPaths.push(message);
        console.log("NEW PATH")
        $.ajax({
            type: 'POST',
            async: false,
            url: apiURI+'/createPath',
            data: JSON.stringify(message),
            contentType: "application/json; charset=utf-8",
            traditional: true,
            success : function(msg) {
                if(!msg.error){
                    console.log("CREATE PATH");
                    console.log(msg.message);
                    $("#state").append('<p>'+msg.message+'</p>');
                    okmsg = true;
                } else {
                    console.log(msg.error);
                }
            },
            error : function(xhr, msg) {
                console.log('ERROR: \
                ' + msg + ' - ' + xhr.responseText+ ' - No API available');
            }
        })         
        return okmsg;
    };

    function deletePath(pathId){
        var okmsg = false;
        console.log(pathId);
        console.log("DELETE PATH")
        $.ajax({
            type: 'DELETE',
            async: false,
            url: apiURI+'/path/'+pathId,
            contentType: "application/json; charset=utf-8",
            traditional: true,
            success : function(msg) {
                if(!msg.error){
                    console.log("DELETE PATH");
                    console.log(msg.message);
                    $("#state").append('<p>'+msg.message+'</p>');
                    okmsg = true;
                } else {
                    console.log(msg.error);
                }
            },
            error : function(xhr, msg) {
                console.log('ERROR: \
                ' + msg + ' - ' + xhr.responseText+ ' - No API available');
            }
        })         
        return okmsg;
    };     

    function getState() {
        $.ajax({
            type: 'GET',
            url: apiURI+'/state',
            dataType: 'json',
            async: false,
            success : function(msg) {
                if(!msg.error){
                    lmsState = msg.message;
                    //console.log("STATE");
                    //console.log(lmsState);
                    return true;
                } else {
                    lmsState = null;
                    addAlertError(msg.error);
                    return false;
                }
            },
            error : function(xhr, msg) {
                lmsState = null;
                addAlertError('ERROR: \
                ' + msg + ' - ' + xhr.responseText+ ' - No API available');
                return false;
            }
        })        
    };

    function setPlayUrl(ip) {
        var uriPlay = 'http://'+ip+':'+'8080/api';
        var message = {type: "master"}; 
        var okmsg = false;
        $.ajax({
            type: 'POST',
            async: false,
            url: uriPlay,
            data: JSON.stringify(message),
            contentType: "application/json; charset=utf-8",
            traditional: true,
            success : function(msg) {
                if(!msg.error){
                    console.log("PLAY");
                    console.log(msg);
                    okmsg = true;
                } else {
                    console.log(msg.error);
                }
            },
            error : function(xhr, msg) {
                console.log('ERROR: \
                ' + msg + ' - ' + xhr.responseText+ ' - No API available');
            }
        })

        return okmsg;
    };

    //////////////////////////////////////////////////////////////
	//  					ALERTS METHODS						//
	//////////////////////////////////////////////////////////////
    function addAlertError(message) {
        var id = 'lmsError';
        var JQueryId = "#" + id;
        $('#error').append(
            '<div style="display:none;" class="alert alert-warning" id="' + id + '">' +
                '<button type="button" class="close" data-dismiss="alert">' +
                '×</button><span class="glyphicon glyphicon-remove-sign" aria-hidden="true"></span> ' + message + '</div>');

        $(JQueryId).fadeIn(500);

        window.setTimeout(function () {
            // closing the popup
            $(JQueryId).fadeTo(300, 0.5).slideUp(1000, function () {
                $(JQueryId).alert('close');
            });
        }, 2000);
        return true;
    };
    function addAlertSuccess(message) {
        var id = 'lmsSuccess';
        var JQueryId = "#" + id;
        $('#success').append(
            '<div style="display:none;" class="alert alert-success" id="' + id + '">' +
                '<button type="button" class="close" data-dismiss="alert">' +
                '×</button><span class="glyphicon glyphicon-ok-sign" aria-hidden="true"></span> ' + message + '</div>');

        $(JQueryId).fadeIn(500);

        window.setTimeout(function () {
            // closing the popup
            $(JQueryId).fadeTo(300, 0.5).slideUp(1000, function () {
                $(JQueryId).alert('close');
            });
        }, 2000);
        return true;
    };
    
    //////////////////////////////////////////////////////////////
    //                      INTERACT METHODS                    //
    //////////////////////////////////////////////////////////////
    (function (interact) {
    
        var element = document.getElementById('grid-snap'),
        x = 0, y = 0;
        var layer = 1;

        interact('.outputCrop')
            .draggable({
                snap: {
                  mdoe: element,
                  range: Infinity,
                  element: { x: 0, y: 0 }
                },
                inertia: true,
                restrict: {
                  restriction: "parent",
                  endOnly: true,
                  elementRect: { top: 0, left: 0, bottom: 1, right: 1 }
                },
                onmove: dragMoveListener
            })
            .resizable({
                inertia: true,
                preserveAspectRatio: true,
                edges: { left: false, right: true, bottom: true, top: false },
                onmove: dragResizeListener
            })
            .on('tap', function(event) {
                var target = event.target;
                target.style.zIndex = layer;
                setCrop(target);
                ++layer;
            })
            .on('doubletap', function(event){
                var target = event.target;
                if(target.clientWidth >= Number(target.style.maxWidth.replace(/\D/g,''))-20
                    && target.clientHeight >= Number(target.style.maxHeight.replace(/\D/g,''))-20)
                {
                    target.style.width  = (winWidth/2).toFixed(0) + 'px';
                    target.style.height = (winHeight/2).toFixed(0) + 'px';
                } else {
                    var maxWidth  = Number(winWidth - Number(target.getAttribute('data-x')) - target.clientWidth);
                    var maxHeight = Number(winHeight - Number(target.getAttribute('data-y')) - target.clientHeight);
                    console.log("DOUBLE TAP");
                    if (maxHeight > maxWidth){

                        console.log("Max Width -> height: " + Number((target.clientWidth + maxWidth)/target.clientWidth*target.clientHeight));
                        console.log(target.clientWidth );
                        console.log(maxWidth);
                        console.log(target.clientHeight);

                        target.style.height = Number((target.clientWidth + maxWidth)/target.clientWidth*target.clientHeight) + 'px';
                        target.style.width  = Number(target.clientWidth + maxWidth) + 'px';
                    } else {

                        console.log("Max Height -> Width: " + Number(target.clientWidth * (target.clientHeight + maxHeight)/target.clientHeight));

                        target.style.width  = Number(target.clientWidth * (target.clientHeight + maxHeight)/target.clientHeight) + 'px';
                        target.style.height = Number(target.clientHeight + maxHeight) + 'px';
                    }
                }
                setCrop(target);
                ++layer;
            });

        function dragMoveListener (event) {
            var target = event.target,
                // keep the dragged position in the data-x/data-y attributes
                x = (parseFloat(target.getAttribute('data-x')) || 0) + event.dx,
                y = (parseFloat(target.getAttribute('data-y')) || 0) + event.dy;
            target.style.zIndex = layer;
            // translate the element
            target.style.webkitTransform =
            target.style.transform =
              'translate(' + x.toFixed(0) + 'px, ' + y.toFixed(0) + 'px)';

            // update the posiion attributes
            target.setAttribute('data-x', x.toFixed(0));
            target.setAttribute('data-y', y.toFixed(0));
            setCrop(target);
            ++layer;
        }

        function dragResizeListener (event) {
            var target = event.target,
                    x = (parseInt(target.getAttribute('data-x')) || 0),
                    y = (parseInt(target.getAttribute('data-y')) || 0);

            target.style.zIndex = layer;

            if(target.clientWidth + Number(target.getAttribute('data-x')) < Number(target.style.maxWidth.replace(/\D/g,'')) 
                && target.clientHeight+Number(target.getAttribute('data-y')) < Number(target.style.maxHeight.replace(/\D/g,''))){
                // update the element's style
                target.style.width  = event.rect.width.toFixed(0) + 'px';
                target.style.height = event.rect.height.toFixed(0) + 'px';

                // translate when resizing from top or left edges
                x += event.deltaRect.left;
                y += event.deltaRect.top;

                target.style.webkitTransform = target.style.transform =
                    'translate(' + x + 'px,' + y + 'px)';

                target.setAttribute('data-x', x);
                target.setAttribute('data-y', y);
                setCrop(target);
                ++layer;
            } else {
                if(target.clientWidth + Number(target.getAttribute('data-x')) > Number(target.style.maxWidth.replace(/\D/g,''))){
                    target.style.width  = (Number(target.style.maxWidth.replace(/\D/g,'')) - Number(target.getAttribute('data-x'))) + 'px';
                }
                if(target.clientHeight+Number(target.getAttribute('data-y')) > Number(target.style.maxHeight.replace(/\D/g,''))){
                    target.style.height = (Number(target.style.maxHeight.replace(/\D/g,'')) - Number(target.getAttribute('data-y'))) + 'px';
                }
            }
        }

        window.dragResizeListener = dragResizeListener;
        window.dragMoveListener = dragMoveListener;

    }(window.interact));
});