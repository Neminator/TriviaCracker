var userID = null;
var cachedLicenseStatus = null;
var cachedLicenseCachedUntilTime = new Date(0);

function setUp() {
    
    setTimeout(function() {
        var hackButtonClass = "hackButton";
        
        var existingHackButton = $("." + hackButtonClass);
        var hackButtonContainer = $(".btns-menu.pull-right");
        var achievementButton = $(".btn.btn-primary.achievements");

        if(existingHackButton.length == 0 && hackButtonContainer.length != 0) {
            var hackButton = $("<button />");
            var hackImage = $("<img title='Run Trivia Cracker!' style='width: 30px' />");

            var hackButtonImage = 'images/app/triviaCrackerButton.png';
            hackImage.attr("src", chrome.extension.getURL(hackButtonImage));

            hackButton.append(hackImage);
            hackButton.addClass(hackButtonClass);
            hackButton.click(findAnswer);

            hackButtonContainer.append(hackButton);
            achievementButton.hide();

            getUserID();
        }
        else{
            setUp();
        }
    }, 500);

}

function tellUserToPurchase() {
    alert('Your Trivia Cracker free trial has expired. Please buy the full version to continue using Trivia Cracker.');
    window.open("https://chrome.google.com/webstore/detail/trivia-cracker/mpaoffaaolfohpleklnbmhbndphfgeef");
}

function verifyLicense(callback) {
    var now = new Date();
    var timeDiff = cachedLicenseCachedUntilTime - now;

    if(cachedLicenseStatus && timeDiff > 0) {
        // use cached license status
        console.log("Trivia Cracker cached license: " + cachedLicenseStatus);
        console.log("Cached until: " + cachedLicenseCachedUntilTime);

        if(cachedLicenseStatus == "FULL" || cachedLicenseStatus == "FREE_TRIAL") {
            callback(cachedLicenseStatus);
        }
        else {
            tellUserToPurchase();
        }
    }
    else {
        // check license status and cache it

        chrome.runtime.sendMessage({"verifyLicense": true}, function(licenseStatus) {
            
            console.log("Trivia Cracker license: " + licenseStatus);
            cachedLicenseStatus = licenseStatus;

            if(licenseStatus == "FULL" || licenseStatus == "FREE_TRIAL") {
                // cache for 30 minutes
                cachedLicenseCachedUntilTime = new Date(now.getTime() + 1000*60*30);
                
                callback(licenseStatus);
            }
            else {
                // cache for 1 minute
                cachedLicenseCachedUntilTime = new Date(now.getTime() + 1000*60*1);

                tellUserToPurchase();
            }
        });
    }
}

function findAnswer() {
    verifyLicense(function() {
        var url = (window.location.href);
        var urlParts = url.split("#game/");
        
        if(urlParts.length == 2) {
            // we are in a game, look for an answer

            var gameID = urlParts[1];
            
            TriviaCrack.GetGameData(gameID, userID, new Date().getTime(), function(err, response) {
                var response = response.response;

                if(response.type == "DUEL_GAME") {
                    // game type is a many-user challenge
                    findManyUserChallengeAnswer(response);
                }
                else {
                    // game type is either regular, playing for a crown, or a
                    // two person challenge
                    findRegularAnswer(response);
                }
            });
        }
    });
}

function findRegularAnswer(response) {
    var questionText = $(".question-container").find("p").text().toLowerCase();

    // crown or regular questions    
    var questions = response.spins_data.spins[0].questions;
    
    // check if two person challenge questions were also sent
    // if so, add them to questions array we will search through
    if(response.spins_data.spins[1]) {
        questions = questions.concat(response.spins_data.spins[1].questions);
    }

    questions.forEach(function(questionItem) {
        var question = questionItem.question;

        if(question.text.toLowerCase() == questionText) {
            var correctAnswerString = question.answers[question.correct_answer];
            clickCorrectAnswer(correctAnswerString);
        }
    });
}

function findManyUserChallengeAnswer(response) {
    var currentQuestionIndexString =  $(".duel-stats").find("span").first().text();
    var currentQuestionIndex = parseInt(currentQuestionIndexString.split("/")[0]) - 1;
    var currentQuestion = response.questions[currentQuestionIndex];

    var correctAnswerString = currentQuestion.answers[currentQuestion.correct_answer];

    clickCorrectAnswer(correctAnswerString);
}

function clickCorrectAnswer(correctAnswer) {
    console.log(correctAnswer);

    var answers = $(".answers-container").find("button");
    answers.each(function(index, answer) {
        var answerText = $(answer).find("p").first().text();

        if(answerText.toLowerCase() == correctAnswer.toLowerCase()) {
            $(answer).trigger("click");
        }
    });
}

function getUserID() {
    var request = window.indexedDB.open("localforage", 1);

    request.onerror = function(event) {
        console.log(event);
    };

    request.onsuccess = function(event) {
        var db = event.target.result;
        var transaction = db.transaction(["keyvaluepairs"]);
        var objectStore = transaction.objectStore("keyvaluepairs");
    
        var request = objectStore.get("session_data");
        
        request.onerror = function(event) {
            console.log(event);
        };
        
        request.onsuccess = function(event) {
            userID = request.result.id;
        };
    };
}

document.addEventListener('DOMContentLoaded', function (evt) {
    setUp();
}, false);