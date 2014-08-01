/**
 * Some of the references.
 *  1. http://stackoverflow.com/questions/5645058/how-to-add-months-to-a-date-in-javascript
 *  2. http://www.hughcalc.org/formula.php
 *  3. http://homeguides.sfgate.com/calculate-five-year-arm-mortgages-9260.html
 *  4. http://stackoverflow.com/questions/2207449/financial-formula-for-calculating-an-adjustable-rate-mortgage
 *  5. http://belkcollegeofbusiness.uncc.edu/buttimer/MBAD%206160/Topic%204%20-%20Adjustable%20Rate%20Mortgages.ppt
 *
 * @type {{calculateMortgage: calculateMortgage, calculateAmortizations: calculateAmortizations}}
 */

var MortgageCalculator = {
    calculateMortgage: function(options) {

        Date.isLeapYear = function (year) {
            return (((year % 4 === 0) && (year % 100 !== 0)) || (year % 400 === 0));
        };

        Date.getDaysInMonth = function (year, month) {
            return [31, (Date.isLeapYear(year) ? 29 : 28), 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month];
        };

        Date.prototype.isLeapYear = function () {
            var y = this.getFullYear();
            return (((y % 4 === 0) && (y % 100 !== 0)) || (y % 400 === 0));
        };

        Date.prototype.getDaysInMonth = function () {
            return Date.getDaysInMonth(this.getFullYear(), this.getMonth());
        };

        Date.prototype.addMonths = function (value) {
            var n = this.getDate();
            this.setDate(1);
            this.setMonth(this.getMonth() + value);
            this.setDate(Math.min(n, this.getDaysInMonth()));
            return this;
        };

        function initOptions (options) {
            var mortgage = {};
            mortgage.loanTermMonths = options.loanTermMonths || 12 * 30;
            mortgage.salePrice = options.salePrice || 500000;
            mortgage.interestRate = options.interestRate || 5.00;
            mortgage.downPayment = options.downPayment || '20%';
            mortgage.salePrice = options.salePrice || 500000;
            mortgage.extras = options.extras || [];
            mortgage.propertyTaxRate = options.propertyTaxRate || 0;
            mortgage.homeInsurance = options.homeInsurance || 0;
            mortgage.adjustFixedRateMonths = options.adjustFixedRateMonths || 0;
            mortgage.adjustInitialCap = options.adjustInitialCap || 0;
            mortgage.adjustPeriodicCap = options.adjustPeriodicCap || 0;
            mortgage.adjustLifetimeCap = options.adjustLifetimeCap || 0;
            mortgage.adjustIntervalMonths = options.adjustIntervalMonths || 12;
            mortgage.startDate = options.startDate || new Date();

            return mortgage;
        }

        function calculateLoanAmount (mortgage) {
            var loanAmount;
            if (typeof mortgage.downPayment == 'string') {
                var downPercent = mortgage.downPayment.substr(0, mortgage.downPayment.indexOf('%'));
                loanAmount = mortgage.salePrice - (mortgage.salePrice * (downPercent / 100));
            } else {
                loanAmount = mortgage.salePrice - mortgage.downPayment;
            }

            return loanAmount;
        }

        function roundDecimals (num) {
            var decimals = 2;
            return Math.round(num * Math.pow(10, decimals)) / Math.pow(10, decimals);
        }

        function roundAmortizationValues (amortization) {
            amortization.monthlyPayment = roundDecimals(amortization.monthlyPayment);
            amortization.interest = roundDecimals(amortization.interest);
            amortization.interestToDate = roundDecimals(amortization.interestToDate);
            amortization.interestLoanYearToDate = roundDecimals(amortization.interestLoanYearToDate);
            amortization.principal = roundDecimals(amortization.principal);
            amortization.principalLoanYearToDate = roundDecimals(amortization.principalLoanYearToDate);
            amortization.principalToDate = roundDecimals(amortization.principalToDate);
            amortization.extra = roundDecimals(amortization.extra);
            amortization.principalTotal = roundDecimals(amortization.principalTotal);
            amortization.paymentTotal = roundDecimals(amortization.paymentTotal);

            return amortization;
        }

        function calculateExtraPayment (mortgage, loanMonth) {
            var totalExtra = 0;
            if (mortgage.extras) {
                for(var i in mortgage.extras) {
                    var extra = mortgage.extras[i];
                    if (loanMonth >= extra.startMonth && loanMonth <= extra.endMonth) {
                        if ((loanMonth - extra.startMonth) % extra.extraIntervalMonths == 0) {
                            totalExtra += extra.extraAmount * 100;
                        }
                    }
                }
            }

            return totalExtra;
        }

        function aprToMonthlyInterest (apr) {
            return apr / (12 * 100);
        }

        function calculatePropertyTax(mortgage) {
            var monthlyPropertyTax;
            if (mortgage.propertyTaxRate && mortgage.propertyTaxRate > 0) {
                monthlyPropertyTax = (mortgage.salePrice * 100 * (options.propertyTaxRate / 100)) / 12;
            } else {
                monthlyPropertyTax = 0;
            }

            return monthlyPropertyTax;
        }

        /**
         * Mortgage needs reset if this mortgage is ARM and current loam month falls into
         * new interest period.
         *
         * @param mortgage
         * @param loanMonth
         */
        function needsInterestReset(mortgage, loanMonth) {
            if (mortgage.adjustFixedRateMonths <= 0 || loanMonth <= mortgage.adjustFixedRateMonths) {
                return false;
            }

            return (loanMonth - mortgage.adjustFixedRateMonths - 1) % mortgage.adjustIntervalMonths == 0;
        }

        function calculateInterestRate(mortgage, loanMonth) {
            if (mortgage.adjustFixedRateMonths <= 0 || loanMonth <= mortgage.adjustFixedRateMonths) {
                return mortgage.interestRate;
            }

            var armInterestRate = mortgage.interestRate + mortgage.adjustInitialCap;
            if (loanMonth > mortgage.adjustFixedRateMonths + 1) {
                for(var i = mortgage.adjustFixedRateMonths + mortgage.adjustIntervalMonths; i <= loanMonth; i += mortgage.adjustIntervalMonths) {
                    armInterestRate += mortgage.adjustPeriodicCap;
                }
            }

            armInterestRate = Math.min(armInterestRate, mortgage.adjustLifetimeCap + mortgage.interestRate)

            return armInterestRate;
        }

        function calculateMonthlyPayment (loanAmount, loanTermMonths, interestRate) {
            var monthlyInterestRate = aprToMonthlyInterest(interestRate);
            var monthlyPayment = loanAmount * (monthlyInterestRate * Math.pow(1 + monthlyInterestRate, loanTermMonths))
                / (Math.pow(1 + monthlyInterestRate, loanTermMonths) - 1);
            return monthlyPayment;
        }

        function calculateAmortizations (mortgage) {

            //To avoid rounding errors, all dollars will be converted to cents and converted back to dollars
            //to response objects.
            var remainingLoanAmountInCents = mortgage.loanAmount * 100;
            var loanAmountInCents = mortgage.loanAmount * 100;
            var monthlyPropertyTaxInCents = calculatePropertyTax(mortgage);
            var amortizations = [];
            var previousAmortization;
            var loanMonth = 0;
            var loanYear = 1;
            var loanYearRollUpSummary = {};
            var currentInterestRate = calculateInterestRate(mortgage, 1);
            var currentMonthlyPaymentInCents = calculateMonthlyPayment(remainingLoanAmountInCents, mortgage.loanTermMonths, currentInterestRate);
            var rollupSummaryFields = ['interest', 'principal', 'extra', 'principalTotal', 'propertyTax', 'paymentTotal'];

            while(remainingLoanAmountInCents >= 1) {
                loanMonth++
                var amortization = {};

                if (needsInterestReset(mortgage, loanMonth)) {
                    currentInterestRate = calculateInterestRate(mortgage, loanMonth);
                    currentMonthlyPaymentInCents = calculateMonthlyPayment(remainingLoanAmountInCents, mortgage.loanTermMonths + 1 - loanMonth, currentInterestRate);
                }

                amortization.interestRate = currentInterestRate;
                amortization.scheduledMonthlyPayment  = currentMonthlyPaymentInCents;
                amortization.interest = remainingLoanAmountInCents * aprToMonthlyInterest(amortization.interestRate);
                amortization.principal = currentMonthlyPaymentInCents - amortization.interest;

                if (remainingLoanAmountInCents < amortization.principal) {
                    amortization.principal = remainingLoanAmountInCents;
                    amortization.extra = 0;
                } else {
                    amortization.extra = calculateExtraPayment(mortgage, loanMonth);
                }

                amortization.principalTotal = amortization.principal + amortization.extra;

                amortization.propertyTax = monthlyPropertyTaxInCents;

                amortization.paymentTotal = amortization.interest + amortization.principalTotal + monthlyPropertyTaxInCents;

                amortization.paymentDate = new Date(mortgage.startDate.getTime()).addMonths(loanMonth);

                remainingLoanAmountInCents -= amortization.principalTotal;

                //If remaining loan amount is less than zero, then set it to zero.
                if (remainingLoanAmountInCents < 0) {
                    remainingLoanAmountInCents = 0;
                }
                amortization.remainingLoanBalnce = remainingLoanAmountInCents;

                amortization.loanMonth = loanMonth;
                amortization.loanYear = loanYear;
                rollupSummaryFields.map( function(field) {
                    if (loanYearRollUpSummary[field]) {
                        loanYearRollUpSummary[field] += amortization[field];
                    } else {
                        loanYearRollUpSummary[field] = amortization[field];
                    }

                    amortization[field + 'LoanYearToDate'] = loanYearRollUpSummary[field];
                });

                if (loanMonth % 12 === 0) {
                    loanYearRollUpSummary = {};
                    loanYear++;
                }

                rollupSummaryFields.map( function(field) {
                    if (previousAmortization) {
                        amortization[field + 'ToDate'] = previousAmortization[field + 'ToDate'] + amortization[field];
                    } else {
                        amortization[field + 'ToDate'] = amortization[field];
                    }
                });

                previousAmortization = amortization;
                amortizations.push(amortization);
            }


            //Round all amortization values to dollars.
            mortgage.totalLoanCost = 0;
            var additionalFieldsToProcess = ['scheduledMonthlyPayment', 'remainingLoanBalnce'];

            for(var i = 0; i < amortizations.length; i++) {
                var amortization = amortizations[i];
                rollupSummaryFields.map( function(field) {
                    amortization[field] = roundDecimals(amortization[field] / 100);
                    amortization[field + 'ToDate'] = roundDecimals(amortization[field + 'ToDate'] / 100);
                    amortization[field + 'LoanYearToDate'] = roundDecimals(amortization[field + 'LoanYearToDate'] / 100);
                });

                additionalFieldsToProcess.map( function(field) {
                    amortization[field] = roundDecimals(amortization[field] / 100);
                });

                mortgage.totalLoanCost += amortization.interest;
            }

            mortgage.totalLoanCost = roundDecimals(mortgage.totalLoanCost);
            mortgage.paymentSchedule = amortizations;
            mortgage.numberOfPayments = mortgage.paymentSchedule.length;
            mortgage.monthlyPayment = mortgage.paymentSchedule[0].scheduledMonthlyPayment;
        }

        var mortgage = initOptions(options);

        mortgage.loanAmount = calculateLoanAmount(mortgage);
        calculateAmortizations(mortgage);
        return mortgage;
    }
}
